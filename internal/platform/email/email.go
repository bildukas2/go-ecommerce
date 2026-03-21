package email

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	DriverMailpit = "mailpit"
	DriverSMTP    = "smtp"
)

type Message struct {
	To       string
	Subject  string
	HTMLBody string
}

type Sender interface {
	Send(ctx context.Context, msg Message) error
}

type Config struct {
	Driver       string
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	FromName     string
	FromEmail    string
}

func ConfigFromEnv() Config {
	port := 1025
	if raw := strings.TrimSpace(os.Getenv("EMAIL_PORT")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			port = parsed
		}
	}

	driver := strings.ToLower(strings.TrimSpace(os.Getenv("EMAIL_DRIVER")))
	if driver == "" {
		driver = DriverMailpit
	}

	host := strings.TrimSpace(os.Getenv("EMAIL_HOST"))
	if host == "" {
		host = "localhost"
	}

	fromName := strings.TrimSpace(os.Getenv("EMAIL_FROM_NAME"))
	if fromName == "" {
		fromName = "Store"
	}

	fromEmail := strings.TrimSpace(os.Getenv("EMAIL_FROM_ADDR"))
	if fromEmail == "" {
		fromEmail = strings.TrimSpace(os.Getenv("EMAIL_FROM_EMAIL"))
	}
	if fromEmail == "" {
		fromEmail = "noreply@example.com"
	}

	return Config{
		Driver:       driver,
		SMTPHost:     host,
		SMTPPort:     port,
		SMTPUsername: strings.TrimSpace(os.Getenv("EMAIL_USERNAME")),
		SMTPPassword: os.Getenv("EMAIL_PASSWORD"),
		FromName:     fromName,
		FromEmail:    fromEmail,
	}
}

func MergeConfig(base Config, override Config) Config {
	out := base
	if v := strings.ToLower(strings.TrimSpace(override.Driver)); v != "" {
		out.Driver = v
	}
	if v := strings.TrimSpace(override.SMTPHost); v != "" {
		out.SMTPHost = v
	}
	if override.SMTPPort > 0 {
		out.SMTPPort = override.SMTPPort
	}
	if strings.TrimSpace(override.SMTPUsername) != "" {
		out.SMTPUsername = strings.TrimSpace(override.SMTPUsername)
	}
	if override.SMTPPassword != "" {
		out.SMTPPassword = override.SMTPPassword
	}
	if v := strings.TrimSpace(override.FromName); v != "" {
		out.FromName = v
	}
	if v := strings.TrimSpace(override.FromEmail); v != "" {
		out.FromEmail = v
	}
	return out
}

func NewSenderFromConfig(cfg Config) (Sender, error) {
	driver := strings.ToLower(strings.TrimSpace(cfg.Driver))
	if driver == "" {
		driver = DriverMailpit
	}
	if cfg.SMTPPort <= 0 {
		cfg.SMTPPort = 1025
	}
	if strings.TrimSpace(cfg.SMTPHost) == "" {
		cfg.SMTPHost = "localhost"
	}
	if strings.TrimSpace(cfg.FromEmail) == "" {
		cfg.FromEmail = "noreply@example.com"
	}
	if _, err := mail.ParseAddress(cfg.FromEmail); err != nil {
		return nil, fmt.Errorf("invalid from email: %w", err)
	}

	switch driver {
	case DriverMailpit, DriverSMTP:
		return &smtpSender{
			host:        cfg.SMTPHost,
			port:        cfg.SMTPPort,
			username:    cfg.SMTPUsername,
			password:    cfg.SMTPPassword,
			fromName:    strings.TrimSpace(cfg.FromName),
			fromEmail:   strings.TrimSpace(cfg.FromEmail),
			helloHost:   "localhost",
			newSMTP:     smtp.NewClient,
			dialContext: (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported email driver %q", driver)
	}
}

type smtpSender struct {
	host      string
	port      int
	username  string
	password  string
	fromName  string
	fromEmail string
	helloHost string

	newSMTP     func(conn net.Conn, host string) (*smtp.Client, error)
	dialContext func(ctx context.Context, network string, address string) (net.Conn, error)
}

func (s *smtpSender) Send(ctx context.Context, msg Message) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	to := strings.TrimSpace(msg.To)
	if to == "" {
		return errors.New("email recipient is required")
	}
	if _, err := mail.ParseAddress(to); err != nil {
		return fmt.Errorf("invalid recipient email: %w", err)
	}
	if strings.TrimSpace(msg.Subject) == "" {
		return errors.New("email subject is required")
	}

	address := net.JoinHostPort(s.host, strconv.Itoa(s.port))
	conn, err := s.dialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("dial smtp: %w", err)
	}

	// Port 465 uses implicit TLS (SMTPS) — wrap connection before SMTP handshake.
	if s.port == 465 {
		conn = tls.Client(conn, &tls.Config{ServerName: s.host})
	}

	client, err := s.newSMTP(conn, s.host)
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("create smtp client: %w", err)
	}
	defer func() {
		_ = client.Close()
	}()

	if err := client.Hello(s.helloHost); err != nil {
		return fmt.Errorf("smtp hello: %w", err)
	}

	if strings.TrimSpace(s.username) != "" {
		auth := &loginAuth{username: s.username, password: s.password}
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}

	if err := client.Mail(s.fromEmail); err != nil {
		return fmt.Errorf("smtp from: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}

	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}

	payload := buildMessagePayload(s.fromName, s.fromEmail, to, msg.Subject, msg.HTMLBody)
	if _, err := wc.Write(payload); err != nil {
		_ = wc.Close()
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := wc.Close(); err != nil {
		return fmt.Errorf("smtp finalize: %w", err)
	}

	if err := client.Quit(); err != nil {
		return fmt.Errorf("smtp quit: %w", err)
	}
	return nil
}

func buildMessagePayload(fromName, fromEmail, to, subject, htmlBody string) []byte {
	from := fromEmail
	if strings.TrimSpace(fromName) != "" {
		from = (&mail.Address{Name: fromName, Address: fromEmail}).String()
	}
	subject = sanitizeHeader(subject)

	var b bytes.Buffer
	b.WriteString("From: ")
	b.WriteString(from)
	b.WriteString("\r\n")
	b.WriteString("To: ")
	b.WriteString(to)
	b.WriteString("\r\n")
	b.WriteString("Subject: ")
	b.WriteString(subject)
	b.WriteString("\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	b.WriteString(htmlBody)
	return b.Bytes()
}

func sanitizeHeader(in string) string {
	in = strings.ReplaceAll(in, "\r", "")
	in = strings.ReplaceAll(in, "\n", " ")
	return strings.TrimSpace(in)
}

// loginAuth implements smtp.Auth using the LOGIN mechanism
// (required by servers that don't support PLAIN).
type loginAuth struct {
	username string
	password string
}

func (a *loginAuth) Start(_ *smtp.ServerInfo) (string, []byte, error) {
	return "LOGIN", nil, nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}
	switch strings.TrimSpace(strings.ToLower(string(fromServer))) {
	case "username:":
		return []byte(a.username), nil
	case "password:":
		return []byte(a.password), nil
	default:
		return nil, fmt.Errorf("unexpected server challenge: %s", fromServer)
	}
}
