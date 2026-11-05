# frozen_string_literal: true

require 'temporalio/client'
require 'temporalio/converters/data_converter'
require 'temporalio/env_config'
require 'temporalio/worker'

require_relative 'lib/banking/activities'
require_relative 'lib/banking/backend_client'
require_relative 'lib/banking/codec'
require_relative 'lib/banking/account_transfer_workflow'

task_queue = ENV.fetch('TEMPORAL_TASK_QUEUE', '').then { |queue| queue.empty? ? 'MoneyTransfer' : queue }

# Environment only: a developer's default CLI profile may point at a real Cloud
# namespace.
positional, options = Temporalio::EnvConfig::ClientConfig.load_client_connect_options(disable_file: true)
address, namespace = positional

worker_options = {}
if Banking::EncryptionCodec.enabled?
  puts 'Encrypting payloads'
  options[:data_converter] = Temporalio::Converters::DataConverter.new(payload_codec: Banking::EncryptionCodec.new)
  # Workflows run on threads here, which can't call the codec themselves.
  worker_options[:workflow_payload_codec_thread_pool] = Temporalio::Worker::ThreadPool.default
end

client = Temporalio::Client.connect(address || 'localhost:7233', namespace || 'default', **options)

worker = Temporalio::Worker.new(
  client:,
  task_queue:,
  workflows: [Banking::AccountTransferWorkflow],
  activities: Banking::Activities.all(Banking::BackendClient.new(ENV.fetch('BANKING_BACKEND_URL', ''))),
  **worker_options
)

puts "Ruby worker started, listening on task queue: #{task_queue}"
$stdout.flush

worker.run(shutdown_signals: %w[SIGINT SIGTERM])
