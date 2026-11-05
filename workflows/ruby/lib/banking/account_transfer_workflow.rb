# frozen_string_literal: true

require 'temporalio/error'
require 'temporalio/retry_policy'
require 'temporalio/search_attributes'
require 'temporalio/workflow'
require 'timeout'

require_relative 'activities'

module Banking
  # Moves money between two accounts. It's dynamic, so it runs for every
  # Workflow Type, and the type picks the scenario.
  class AccountTransferWorkflow < Temporalio::Workflow::Definition
    workflow_dynamic
    workflow_raw_args

    Workflow = Temporalio::Workflow
    ApplicationError = Temporalio::Error::ApplicationError

    ADVANCED_VISIBILITY = 'AccountTransferWorkflowAdvancedVisibility'
    NEEDS_APPROVAL = 'AccountTransferWorkflowHumanInLoop'
    BUG = 'AccountTransferWorkflowRecoverableFailure'
    APPROVAL_SECONDS = 30

    STEP = Temporalio::SearchAttributes::Key.new('Step', Temporalio::SearchAttributes::IndexedValueType::KEYWORD)

    # No max_attempts: an outage can last longer than any count we'd pick, so
    # Activities retry until they succeed or fail non-retryably.
    ACTIVITY_OPTIONS = {
      start_to_close_timeout: 5,
      retry_policy: Temporalio::RetryPolicy.new(initial_interval: 1, backoff_coefficient: 2, max_interval: 30)
    }.freeze

    def initialize
      @progress = 0
      @transfer_state = ''
      @deposit_response = { 'chargeId' => '' }
      @approved = false
    end

    def execute(*args)
      input = Workflow.payload_converter.from_payload(args.first.payload)
      @workflow_type = Workflow.info.workflow_type
      idempotency_key = Workflow.random.uuid

      # Validate
      upsert_step('Validate')
      Workflow.execute_activity(Activities::Validate, input, **ACTIVITY_OPTIONS)
      update_progress(25, 1)

      # Withdraw
      upsert_step('Withdraw')
      Workflow.execute_activity(Activities::Withdraw, idempotency_key, input['amount'], @workflow_type,
                                **ACTIVITY_OPTIONS)
      update_progress(50, 3)

      # Human in the loop: wait for the approveTransfer Signal
      if @workflow_type == NEEDS_APPROVAL
        Workflow.execute_activity(Activities::RegisterApproval, input, **ACTIVITY_OPTIONS)
        update_progress(30, 0, 'waiting')

        begin
          Workflow.timeout(APPROVAL_SECONDS) { Workflow.wait_condition { @approved } }
        rescue Timeout::Error
          Workflow.execute_activity(Activities::RemoveApproval, **ACTIVITY_OPTIONS)
          raise ApplicationError.new("Approval not received within #{APPROVAL_SECONDS} seconds",
                                     type: 'ApprovalTimeout', non_retryable: true)
        end
      end

      # A plain exception fails the Workflow Task, not the Workflow. The transfer
      # stays Running, and fixing the code lets it carry on from here.
      raise 'Simulated bug - fix me!' if @workflow_type == BUG

      # Deposit, and undo the withdrawal if it fails for good
      upsert_step('Deposit')
      begin
        @deposit_response = Workflow.execute_activity(Activities::Deposit, idempotency_key, input['amount'],
                                                      @workflow_type, **ACTIVITY_OPTIONS)
        update_progress(75, 1)
      rescue Temporalio::Error::ActivityError => e
        Workflow.logger.info('Deposit failed unrecoverable error, reverting withdraw')
        Workflow.execute_activity(Activities::UndoWithdraw, input['amount'], **ACTIVITY_OPTIONS)
        raise ApplicationError.new(e.cause&.message || e.message, type: 'DepositFailed', non_retryable: true)
      end

      # Send notification
      upsert_step('Send notification')
      Workflow.execute_activity(Activities::SendNotification, **ACTIVITY_OPTIONS)
      update_progress(100, 1, 'finished')

      { 'depositResponse' => @deposit_response }
    end

    workflow_signal name: 'approveTransfer'
    def approve_transfer
      if @transfer_state == 'waiting'
        @approved = true
      else
        Workflow.logger.info('Approval not applied. Transfer is not waiting for approval')
      end
    end

    workflow_query name: 'transferStatus'
    def transfer_status
      {
        'progressPercentage' => @progress,
        'transferState' => @transfer_state,
        'workflowStatus' => '',
        'chargeResult' => @deposit_response,
        'approvalTime' => APPROVAL_SECONDS
      }
    end

    private

    def update_progress(progress, seconds, state = 'running')
      Workflow.sleep(seconds) if seconds.positive?
      @transfer_state = state
      @progress = progress
    end

    def upsert_step(step)
      Workflow.upsert_search_attributes(STEP.value_set(step)) if @workflow_type == ADVANCED_VISIBILITY
    end
  end
end
