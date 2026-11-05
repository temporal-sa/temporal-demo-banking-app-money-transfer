# frozen_string_literal: true

require 'temporalio/activity'
require 'temporalio/error'

module Banking
  module Activities
    API_DOWNTIME = 'AccountTransferWorkflowAPIDowntime'
    INVALID_ACCOUNT = 'AccountTransferWorkflowInvalidAccount'
    EVENT_MAX_ATTEMPTS = 10

    def self.all(backend)
      [Validate, Withdraw, Deposit, SendNotification, UndoWithdraw, RegisterApproval,
       RemoveApproval].map { |activity| activity.new(backend) }
    end

    # Shared wiring for the transfer Activities.
    class Base < Temporalio::Activity::Definition
      def initialize(backend)
        super()
        @backend = backend
      end

      private

      def info
        Temporalio::Activity::Context.current.info
      end

      def workflow_id
        info.workflow_id
      end

      def attempt
        info.attempt
      end

      # Stands in for a call to the bank. Each attempt is faster than the last,
      # and the fifth one always works.
      def simulate_external_operation(milliseconds, workflow_type)
        sleep milliseconds / attempt / 1000.0
        attempt < 5 ? workflow_type : 'NoError'
      end
    end

    class Validate < Base
      def execute(input)
        @backend.emit(workflow_id, 'validate', 'running')
        sleep 1
        @backend.emit(workflow_id, 'validate', 'completed',
                      detail: "Validated: #{input['fromAccount']} -> #{input['toAccount']}")
        'SUCCESS'
      end
    end

    class Withdraw < Base
      def execute(_idempotency_key, amount, workflow_type)
        @backend.emit(workflow_id, 'withdraw', 'running', attempt:, max_attempts: EVENT_MAX_ATTEMPTS)

        if simulate_external_operation(1000, workflow_type) == API_DOWNTIME
          @backend.emit(workflow_id, 'withdraw', 'retrying', attempt:, max_attempts: EVENT_MAX_ATTEMPTS,
                                                             error: 'Withdraw API unavailable')
          raise Temporalio::Error::ApplicationError, 'Withdraw activity failed, API unavailable'
        end

        @backend.emit(workflow_id, 'withdraw', 'completed', detail: format('Withdrawn $%.2f', amount))
        'SUCCESS'
      end
    end

    class Deposit < Base
      def execute(_idempotency_key, amount, workflow_type)
        @backend.emit(workflow_id, 'deposit', 'running', attempt:, max_attempts: EVENT_MAX_ATTEMPTS)

        if simulate_external_operation(1000, workflow_type) == INVALID_ACCOUNT
          @backend.emit(workflow_id, 'deposit', 'failed', error: 'Account is invalid')
          # Retrying can't fix a bad account, so the Workflow compensates at once.
          raise Temporalio::Error::ApplicationError.new('Deposit activity failed, account is invalid',
                                                        type: 'InvalidAccount', non_retryable: true)
        end

        @backend.emit(workflow_id, 'deposit', 'completed', detail: format('Deposited $%.2f', amount))
        { 'chargeId' => 'example-transfer-id' }
      end
    end

    class SendNotification < Base
      def execute
        sleep 1
        @backend.emit(workflow_id, 'send_notification_success', 'completed',
                      detail: 'Customer notified: Transfer completed successfully!')
        'SUCCESS'
      end
    end

    class UndoWithdraw < Base
      def execute(amount)
        @backend.emit(workflow_id, 'undo_withdraw', 'running')
        sleep 1
        @backend.emit(workflow_id, 'undo_withdraw', 'completed',
                      detail: format('Withdrawal reversed: $%.2f', amount))
        true
      end
    end

    class RegisterApproval < Base
      def execute(input)
        @backend.emit(workflow_id, 'approval_wait', 'running', detail: 'Awaiting bank employee approval...')
        @backend.register_approval(workflow_id, input)
        'SUCCESS'
      end
    end

    class RemoveApproval < Base
      def execute
        @backend.remove_approval(workflow_id)
        @backend.emit(workflow_id, 'approval_wait', 'failed',
                      detail: 'Approval timed out — transfer denied automatically')
        'SUCCESS'
      end
    end
  end
end
