package email

import (
	"bufio"
	"context"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestConfigFromEnvDefaults(t *testing.T) {
	t.Setenv("EMAIL_DRIVER", "")
	t.Setenv("EMAIL_HOST", "")
	t.Setenv("EMAIL_PORT", "")
	t.Setenv("EMAIL_FROM_NAME", "")
	t.Setenv("EMAIL_FROM_ADDR", "")
	t.Setenv("EMAIL_FROM_EMAIL", "")
	t.Setenv("EMAIL_USERNAME", "")
	t.Setenv("EMAIL_PASSWORD", "")

	cfg := ConfigFromEnv()
	if cfg.Driver != DriverMailpit {
		t.Fatalf("expected default driver %q, got %q", DriverMailpit, cfg.Driver)
	}
	if cfg.SMTPHost != "localhost" {
		t.Fatalf("expected default host localhost, got %q", cfg.SMTPHost)
	}
	if cfg.SMTPPort != 1025 {
		t.Fatalf("expected default port 1025, got %d", cfg.SMTPPort)
	}
	if cfg.FromEmail != "noreply@example.com" {
		t.Fatalf("expected default from email, got %q", cfg.FromEmail)
	}
}

func TestNewSenderFromConfigRejectsUnsupportedDriver(t *testing.T) {
	_, err := NewSenderFromConfig(Config{Driver: "ses", FromEmail: "noreply@example.com"})
	if err == nil {
		t.Fatal("expected error for unsupported driver")
	}
}

func TestSMTPSenderSend(t *testing.T) {
	server := startFakeSMTPServer(t)
	sender, err := NewSenderFromConfig(Config{
		Driver:    DriverSMTP,
		SMTPHost:  server.host,
		SMTPPort:  server.port,
		FromName:  "Store",
		FromEmail: "noreply@example.com",
	})
	if err != nil {
		t.Fatalf("new sender: %v", err)
	}

	err = sender.Send(context.Background(), Message{
		To:       "customer@example.com",
		Subject:  "Order confirmed",
		HTMLBody: "<h1>Hello</h1>",
	})
	if err != nil {
		t.Fatalf("send: %v", err)
	}

	select {
	case got := <-server.messages:
		if !strings.Contains(got, "Subject: Order confirmed") {
			t.Fatalf("expected subject header, got: %s", got)
		}
		if !strings.Contains(got, "<h1>Hello</h1>") {
			t.Fatalf("expected html body, got: %s", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for smtp payload")
	}
}

type fakeSMTPServer struct {
	host     string
	port     int
	messages chan string
	listener net.Listener
}

func startFakeSMTPServer(t *testing.T) *fakeSMTPServer {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	host, portStr, _ := net.SplitHostPort(ln.Addr().String())
	port, _ := strconv.Atoi(portStr)

	s := &fakeSMTPServer{
		host:     host,
		port:     port,
		messages: make(chan string, 1),
		listener: ln,
	}
	t.Cleanup(func() {
		_ = ln.Close()
	})

	go s.serve()
	return s
}

func (s *fakeSMTPServer) serve() {
	conn, err := s.listener.Accept()
	if err != nil {
		return
	}
	defer conn.Close()

	rw := bufio.NewReadWriter(bufio.NewReader(conn), bufio.NewWriter(conn))
	write := func(line string) {
		_, _ = rw.WriteString(line + "\r\n")
		_ = rw.Flush()
	}

	write("220 localhost ESMTP")

	var dataBuilder strings.Builder
	inData := false
	for {
		line, err := rw.ReadString('\n')
		if err != nil {
			return
		}
		line = strings.TrimRight(line, "\r\n")

		if inData {
			if line == "." {
				inData = false
				write("250 2.0.0 queued")
				s.messages <- dataBuilder.String()
				continue
			}
			dataBuilder.WriteString(line)
			dataBuilder.WriteString("\n")
			continue
		}

		switch {
		case strings.HasPrefix(line, "EHLO") || strings.HasPrefix(line, "HELO"):
			write("250-localhost")
			write("250 OK")
		case strings.HasPrefix(line, "MAIL FROM:"):
			write("250 2.1.0 ok")
		case strings.HasPrefix(line, "RCPT TO:"):
			write("250 2.1.5 ok")
		case strings.HasPrefix(line, "DATA"):
			write("354 end with <CR><LF>.<CR><LF>")
			inData = true
		case strings.HasPrefix(line, "QUIT"):
			write("221 bye")
			return
		default:
			write("250 ok")
		}
	}
}
