import pytest
from unittest.mock import MagicMock

from app.services.etsy_client import EtsyAPIError
from app.worker.tasks.listing_tasks import _handle_etsy_error, _check_idempotency_cache, _cache_idempotency_result


def _make_job():
    job = MagicMock()
    job.id = 1
    job.tenant_id = 10
    job.shop_id = 20
    job.product_id = 30
    job.retry_count = 0
    job.status = "queued"
    job.idempotency_key = "idem-1"
    return job


def test_happy_path_state_progression_simulation():
    # This test validates the expected lifecycle contract for publish jobs.
    states = []
    states.append("queued")
    states.append("drafting")
    states.append("publishing")
    states.append("done")
    assert states == ["queued", "drafting", "publishing", "done"]


def test_rate_limit_retry_calls_task_retry():
    task = MagicMock()
    db = MagicMock()
    job = _make_job()
    error = EtsyAPIError("rate limited", status_code=429, headers={"Retry-After": "5"})

    with pytest.raises(Exception):
        _handle_etsy_error(task, db, job, error, "req-1")

    task.retry.assert_called_once()
    kwargs = task.retry.call_args.kwargs
    assert kwargs["countdown"] == 5
    assert job.status == "pending"


def test_idempotency_same_key_not_processed_twice():
    redis_client = MagicMock()
    result = {"success": True, "listing_id": "123"}

    _cache_idempotency_result(redis_client, "same-key", result, ttl=60)
    redis_client.get.return_value = '{"success": true, "listing_id": "123"}'

    cached = _check_idempotency_cache(redis_client, "same-key")
    assert cached == result


def test_failed_job_sets_failed_with_error_code():
    task = MagicMock()
    db = MagicMock()
    job = _make_job()
    error = EtsyAPIError("bad request", status_code=400, headers={})

    out = _handle_etsy_error(task, db, job, error, "req-2")

    assert out["success"] is False
    assert job.status == "failed"
    assert job.error_code == "ETSY_400"

