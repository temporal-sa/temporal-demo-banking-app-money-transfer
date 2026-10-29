# Every target runs in containers, so the host needs only Docker, Compose and make.
#
#   make demo                        local Temporal dev server
#   make demo ENCRYPT=1              add payload encryption and a codec server on :8081
#   make demo CLOUD_ENV=cloud.env    run against Temporal Cloud instead (see cloud.env.example)
#
# Pass the same ENCRYPT and CLOUD_ENV to dev, worker and logs.

ENCRYPT ?=
CLOUD_ENV ?=

ifneq ($(CLOUD_ENV),)
ifeq ($(wildcard $(CLOUD_ENV)),)
$(error CLOUD_ENV=$(CLOUD_ENV) doesn't exist; copy cloud.env.example and fill it in)
endif
endif

COMPOSE = BANKING_ENCRYPT=$(ENCRYPT) docker compose \
	$(if $(CLOUD_ENV),--env-file $(CLOUD_ENV),--profile local) \
	$(if $(ENCRYPT),--profile encrypt)

.DEFAULT_GOAL := help
.PHONY: help demo dev worker reset test logs down

help: ## List the targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-z]+:.*## / {printf "  make %-7s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

demo: ## Build the images and start the whole stack in the background
	$(COMPOSE) up --build --detach --wait
	@echo ""
	@echo "  App:       http://localhost:5173"
	@echo "  API:       http://localhost:8000"
	@echo "  Temporal:  $(if $(CLOUD_ENV),the Namespace in $(CLOUD_ENV),http://localhost:8233)"
	$(if $(ENCRYPT),@echo "  Codec:     http://localhost:8081 (set it as the codec endpoint in the Temporal UI)")
	@echo ""
	@echo "  Stop it with: make down"

dev: ## Start the stack with source mounts; the API and frontend reload on save
	$(COMPOSE) --file docker-compose.yml --file docker-compose.dev.yml up --build

worker: ## Rebuild and restart the Worker alone, as after the fix in beat 5
	$(COMPOSE) up --build --detach --wait worker-python

reset: ## Terminate running transfers and clear the API's memory (local dev server only)
	@if [ -n "$(CLOUD_ENV)" ]; then echo "make reset only works on the local dev server"; exit 1; fi
	docker compose --profile local exec temporal temporal --disable-config-file workflow terminate \
		--query 'ExecutionStatus="Running"' --reason "make reset" --yes
	docker compose restart backend

test: ## Lint the Python code; type-check, lint and build the frontend
	docker build --target test --file docker/backend.Dockerfile .
	docker build --target test --file docker/frontend.Dockerfile .

logs: ## Follow the logs of every running service
	$(COMPOSE) logs --follow

down: ## Stop and remove every container, whichever options started it
	docker compose --profile local --profile encrypt down --remove-orphans
