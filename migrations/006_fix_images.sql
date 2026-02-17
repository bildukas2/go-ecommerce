-- +goose Up
UPDATE images 
SET url = '/images/black-t-shirt-mockup-with-realistic-fabric-texture-and-folds-png.png' 
WHERE url = '/images/lack-t-shirt-mockup-with-realistic-fabric-texture-and-folds-png.png';

-- +goose Down
UPDATE images 
SET url = '/images/lack-t-shirt-mockup-with-realistic-fabric-texture-and-folds-png.png' 
WHERE url = '/images/black-t-shirt-mockup-with-realistic-fabric-texture-and-folds-png.png';
