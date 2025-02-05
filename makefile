.PHONY: all run clean

# Default target: run the demo
all: build

build: apricot.js

# Build apricot.js from apricot.ts using tsc.
# (Make sure you have a tsconfig.json configured appropriately, or tsc will use defaults.)
apricot.js: apricot.ts
	tsc

# Run the built JavaScript with the arguments passed via ARGS.
# If ARGS is not provided, print a usage message.
run: apricot.js
	@if [ -z "$(ARGS)" ]; then \
		echo "Usage: make run ARGS=\"-l conversations.json\""; \
		exit 1; \
	fi
	@echo "Running apricot with ARGS=$(ARGS)..."
	node apricot.js $(ARGS)

# Clean up generated JavaScript.
clean:
	rm -f apricot.js
