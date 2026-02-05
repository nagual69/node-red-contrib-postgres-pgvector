# OpenTelemetry Quick Setup Guide

Get enterprise observability running in 5 minutes.

## Option 1: Jaeger All-in-One (Fastest)

**Start Jaeger with OTLP support:**
```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 4318:4318 \
  -p 16686:16686 \
  jaegertracing/all-in-one:latest
```

**Enable OTEL in Node-RED:**
```bash
export OTEL_ENABLED=true
export OTEL_SERVICE_NAME=node-red-dev
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
node-red
```

**View traces:**
Open http://localhost:16686 in your browser

---

## Option 2: Grafana Stack (Production-Ready)

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./tempo-config.yaml:/etc/tempo.yaml
      - tempo-data:/tmp/tempo
    ports:
      - "4318:4318"   # OTLP HTTP
      - "3200:3200"   # Tempo API

  prometheus:
    image: prom/prometheus:latest
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - ./grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"
    depends_on:
      - tempo
      - prometheus

volumes:
  tempo-data:
  prometheus-data:
  grafana-data:
```

**tempo-config.yaml:**
```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/traces

compactor:
  compaction:
    block_retention: 48h
```

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node-red-pgvector'
    scrape_interval: 15s
    static_configs:
      - targets: ['host.docker.internal:4318']
    metrics_path: '/v1/metrics'
```

**grafana-datasources.yml:**
```yaml
apiVersion: 1
datasources:
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    isDefault: true

  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
```

**Start the stack:**
```bash
docker-compose up -d
```

**Configure Node-RED:**
```bash
export OTEL_ENABLED=true
export OTEL_SERVICE_NAME=node-red-production
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
node-red
```

**Access:**
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200

---

## Option 3: Cloud Providers

### Grafana Cloud

**Sign up:** https://grafana.com/products/cloud/

**Get your OTLP endpoint:**
```
Grafana Cloud Portal → Traces → OTLP
```

**Configure Node-RED:**
```bash
export OTEL_ENABLED=true
export OTEL_SERVICE_NAME=node-red-prod
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64_token>"
node-red
```

### AWS X-Ray

**Install OTEL Collector:**
```bash
wget https://aws-otel-collector.s3.amazonaws.com/amazon_linux/amd64/latest/aws-otel-collector.rpm
sudo rpm -Uvh aws-otel-collector.rpm
```

**Configure collector for X-Ray:**
```yaml
# /opt/aws/aws-otel-collector/etc/config.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

exporters:
  awsxray:
    region: us-east-1

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [awsxray]
```

**Start collector:**
```bash
sudo systemctl start aws-otel-collector
```

**Configure Node-RED:**
```bash
export OTEL_ENABLED=true
export OTEL_SERVICE_NAME=node-red-prod
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
node-red
```

### Azure Monitor

**Use OTEL Collector with Azure exporter:**
```yaml
exporters:
  azuremonitor:
    instrumentation_key: "<your-instrumentation-key>"

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [azuremonitor]
    metrics:
      receivers: [otlp]
      exporters: [azuremonitor]
```

---

## Verification

**Check if OTEL is enabled:**
```bash
# You should see this in Node-RED logs:
[OpenTelemetry] Initialized for node-red-production, endpoint: http://localhost:4318
```

**Generate some test traces:**
1. Create a pgvector-search node in Node-RED
2. Send a test message with a vector
3. Check your tracing backend for spans

**Example span in Jaeger:**
```
Service: node-red-production
Operation: pgvector-search
Duration: 45ms
Tags:
  - msg.id: 7c4f9e2d.8b3061
  - node.id: abc123
  - node.name: Document Search
  - table: documents
  - column: embedding
  - metric: cosine
```

---

## Troubleshooting

**No traces appearing:**

1. Check OTEL is enabled:
   ```bash
   echo $OTEL_ENABLED  # Should output: true
   ```

2. Check endpoint is reachable:
   ```bash
   curl http://localhost:4318/v1/traces -v
   ```

3. Check Node-RED logs for OTEL initialization

4. Verify collector/backend is running:
   ```bash
   docker ps | grep jaeger
   ```

**High overhead:**

OTEL adds ~1-2ms per operation. If this is too much:
- Reduce sampling rate
- Use head-based sampling
- Disable auto-instrumentation for non-critical paths

---

## Next Steps

1. ✅ Set up tracing backend (Jaeger/Tempo/Cloud)
2. ✅ Enable OTEL in Node-RED
3. ✅ Generate test traces
4. 📊 Create Grafana dashboards
5. 🔔 Set up alerts for errors and slow queries
6. 📖 Read full [Enterprise Guide](./ENTERPRISE.md)

---

## Resources

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Grafana Cloud](https://grafana.com/products/cloud/)
- [Jaeger](https://www.jaegertracing.io/)
- [Tempo](https://grafana.com/oss/tempo/)
- [Example Dashboard](./examples/grafana-dashboard.json)
