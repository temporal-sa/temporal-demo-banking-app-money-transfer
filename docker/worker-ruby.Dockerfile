FROM ruby:3.4-slim AS gems

# bigdecimal, pulled in by google-protobuf, compiles a native extension.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY workflows/ruby/Gemfile workflows/ruby/Gemfile.lock ./
RUN BUNDLE_FROZEN=1 bundle install

FROM ruby:3.4-slim

WORKDIR /app
COPY --from=gems /usr/local/bundle/ /usr/local/bundle/
COPY workflows/ruby/ .

CMD ["bundle", "exec", "ruby", "worker.rb"]
