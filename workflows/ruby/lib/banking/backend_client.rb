# frozen_string_literal: true

require 'json'
require 'net/http'
require 'time'
require 'uri'

module Banking
  # Pushes step updates and approvals to the API. Every call is best effort: a
  # missed UI update shouldn't fail the Activity.
  class BackendClient
    TIMEOUT_SECONDS = 5

    def initialize(base_url)
      @base_url = base_url.chomp('/')
    end

    def emit(workflow_id, step, status, attempt: 1, max_attempts: 1, error: nil, detail: '')
      send_request(Net::HTTP::Post, '/api/internal/events', {
                     workflow_id:, step:, status:, attempt:, max_attempts:, error:, detail:,
                     timestamp: Time.now.iso8601
                   })
    end

    def register_approval(workflow_id, input)
      send_request(Net::HTTP::Post, "/api/internal/pending-approvals/#{workflow_id}", {
                     from_account: input['fromAccount'], to_account: input['toAccount'],
                     amount: input['amount'], created_at: Time.now.iso8601
                   })
    end

    def remove_approval(workflow_id)
      send_request(Net::HTTP::Delete, "/api/internal/pending-approvals/#{workflow_id}")
    end

    private

    def send_request(method, path, body = nil)
      return if @base_url.empty?

      uri = URI("#{@base_url}#{path}")
      request = method.new(uri, 'Content-Type' => 'application/json')
      request.body = JSON.generate(body) if body
      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https', open_timeout: TIMEOUT_SECONDS,
                                          read_timeout: TIMEOUT_SECONDS) { |http| http.request(request) }
    rescue StandardError
      nil
    end
  end
end
