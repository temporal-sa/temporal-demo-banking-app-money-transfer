// Command worker runs the money transfer Workflow and Activities.
package main

import (
	"log"
	"os"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/contrib/envconfig"
	"go.temporal.io/sdk/converter"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"

	"github.com/temporal-sa/temporal-demo-banking-app-money-transfer/workflows/go/transfer"
)

func main() {
	// Environment only: a developer's default CLI profile may point at a real
	// Cloud namespace.
	options, err := envconfig.LoadClientOptions(envconfig.LoadClientOptionsRequest{DisableFile: true})
	if err != nil {
		log.Fatalln("Unable to read the Temporal client settings:", err)
	}
	if options.HostPort == "" {
		options.HostPort = "localhost:7233"
	}
	if options.Namespace == "" {
		options.Namespace = "default"
	}
	if transfer.EncryptionEnabled() {
		log.Println("Encrypting payloads")
		options.DataConverter = converter.NewCodecDataConverter(
			converter.GetDefaultDataConverter(), transfer.NewEncryptionCodec(),
		)
	}

	c, err := client.Dial(options)
	if err != nil {
		log.Fatalln("Unable to connect to Temporal:", err)
	}
	defer c.Close()

	taskQueue := os.Getenv("TEMPORAL_TASK_QUEUE")
	if taskQueue == "" {
		taskQueue = transfer.TaskQueue
	}

	w := worker.New(c, taskQueue, worker.Options{})
	// One implementation serves every scenario. It branches on the Workflow Type.
	for _, name := range transfer.WorkflowTypes {
		w.RegisterWorkflowWithOptions(transfer.AccountTransfer, workflow.RegisterOptions{Name: name})
	}
	w.RegisterActivity(&transfer.Activities{Backend: transfer.NewBackendClient(os.Getenv("BANKING_BACKEND_URL"))})

	log.Printf("Go worker started, listening on task queue: %s", taskQueue)
	if err := w.Run(worker.InterruptCh()); err != nil {
		log.Fatalln("Worker stopped:", err)
	}
}
