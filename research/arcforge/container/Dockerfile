# syntax=docker/dockerfile:1.7
# The arcforge runner container: CUDA user space + uv + the arcforge package with the gpu and
# cloud extras, exactly as uv.lock pins them. Built by Cloud Build (container/cloudbuild.yaml,
# driven by `python -m arcforge.runner image build`) and pulled by digest on every runner VM.
#
# Build context: research/arcforge (the directory holding pyproject.toml and uv.lock).
#
# CUDA must match the runner's driver: the runner boots the Deep Learning VM image pinned in
# arcforge/runner/config.py (NVIDIA driver 580, CUDA 13.0 capable), and uv.lock pins
# torch 2.14.1 with CUDA 13.0 wheels, so the base is CUDA 13.0. torch brings its own CUDA
# libraries; the base image supplies the driver-facing user space and the NVIDIA runtime env.
# tests/runner/test_container.py keeps these pins in step.

ARG CUDA_IMAGE=nvidia/cuda:13.0.3-base-ubuntu24.04@sha256:7c7413a56200486f71f181cad9310f6fd31b6bb21816ade15fc9c1e1e927a5c1
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.13.5@sha256:32a7bb39b496babbd997b0a39a4d66c126bdaf5661b302bf6f06abda8deca6ff

FROM ${UV_IMAGE} AS uv

FROM ${CUDA_IMAGE}

COPY --from=uv /uv /uvx /usr/local/bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PYTHON=3.12 \
    UV_PYTHON_INSTALL_DIR=/opt/python \
    UV_PROJECT_ENVIRONMENT=/opt/arcforge/.venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    PATH=/opt/arcforge/.venv/bin:$PATH

# Determinism (program, DETERMINISM): cuBLAS needs a fixed workspace under
# torch.use_deterministic_algorithms(True). Runner VMs read models from the GCS mirror only.
ENV CUBLAS_WORKSPACE_CONFIG=:4096:8 \
    HF_HUB_OFFLINE=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/arcforge

# Dependencies first, so a code-only change rebuilds one thin layer.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev --extra gpu --extra cloud --no-install-project

COPY arcforge ./arcforge
RUN uv sync --locked --no-dev --extra gpu --extra cloud --no-editable

# Set last: the commit changes every build and must not invalidate the dependency layers.
ARG ARCFORGE_COMMIT=unknown
ENV ARCFORGE_COMMIT=${ARCFORGE_COMMIT}
LABEL org.opencontainers.image.source="https://github.com/alexwelcing/NextDocsSearch" \
      org.opencontainers.image.revision="${ARCFORGE_COMMIT}" \
      org.opencontainers.image.title="arcforge"

ENTRYPOINT ["arcforge"]
CMD ["--help"]
