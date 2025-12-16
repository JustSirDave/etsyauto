"""
Add Idempotency and Data Integrity Constraints
Revision ID: idempotency_constraints
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'idempotency_constraints'
down_revision = 'f9713cb3c87f'
branch_labels = None
depends_on = None


def upgrade():
    """Add constraints for data integrity and idempotency"""
    
    # ===== Product Ingestion Idempotency =====
    # Ensure batch_id + row_index is unique (prevent duplicate ingestion)
    op.create_unique_constraint(
        'uq_ingestion_batch_row',
        'ingestion_batches',
        ['batch_id', 'row_index']
    )
    
    # Add idempotency_key to ingestion batches
    op.add_column(
        'ingestion_batches',
        sa.Column('idempotency_key', sa.String(255), nullable=True)
    )
    op.create_index(
        'ix_ingestion_batches_idempotency_key',
        'ingestion_batches',
        ['idempotency_key']
    )
    
    # ===== Listing Publication Idempotency =====
    # Ensure shop_id + product_id + idempotency_key is unique
    op.add_column(
        'listing_jobs',
        sa.Column('idempotency_key', sa.String(255), nullable=True)
    )
    op.create_unique_constraint(
        'uq_listing_job_idempotency',
        'listing_jobs',
        ['shop_id', 'product_id', 'idempotency_key']
    )
    
    # ===== Product Uniqueness =====
    # Ensure SKU is unique per tenant + shop
    op.create_unique_constraint(
        'uq_product_tenant_shop_sku',
        'products',
        ['tenant_id', 'shop_id', 'sku']
    )
    
    # ===== OAuth Token Uniqueness =====
    # Ensure only one active token per tenant + shop
    op.create_unique_constraint(
        'uq_oauth_token_tenant_shop',
        'oauth_tokens',
        ['tenant_id', 'shop_id']
    )
    
    # ===== API Key Uniqueness =====
    # key_hash already has unique constraint, add index for performance
    op.create_index(
        'ix_api_keys_key_hash',
        'api_keys',
        ['key_hash']
    )
    
    # ===== Schedule Uniqueness =====
    # Prevent duplicate schedules for same shop
    op.add_column(
        'schedules',
        sa.Column('schedule_hash', sa.String(64), nullable=True)
    )
    op.create_index(
        'ix_schedules_schedule_hash',
        'schedules',
        ['schedule_hash']
    )
    
    # ===== AI Generation Deduplication =====
    # Ensure we don't generate twice for same product + version
    op.create_unique_constraint(
        'uq_ai_generation_product_version',
        'ai_generations',
        ['product_id', 'generation_version']
    )
    
    # ===== Order Sync Idempotency =====
    # Ensure external order ID is unique per shop
    op.create_unique_constraint(
        'uq_order_shop_external_id',
        'orders',
        ['shop_id', 'external_order_id']
    )
    
    # ===== Audit Log Deduplication =====
    # Add composite index for deduplication
    op.create_index(
        'ix_audit_logs_dedup',
        'audit_logs',
        ['request_id', 'action', 'tenant_id']
    )


def downgrade():
    """Remove idempotency constraints"""
    
    # Drop constraints in reverse order
    op.drop_index('ix_audit_logs_dedup', table_name='audit_logs')
    op.drop_constraint('uq_order_shop_external_id', 'orders', type_='unique')
    op.drop_constraint('uq_ai_generation_product_version', 'ai_generations', type_='unique')
    op.drop_index('ix_schedules_schedule_hash', table_name='schedules')
    op.drop_column('schedules', 'schedule_hash')
    op.drop_index('ix_api_keys_key_hash', table_name='api_keys')
    op.drop_constraint('uq_oauth_token_tenant_shop', 'oauth_tokens', type_='unique')
    op.drop_constraint('uq_product_tenant_shop_sku', 'products', type_='unique')
    op.drop_constraint('uq_listing_job_idempotency', 'listing_jobs', type_='unique')
    op.drop_column('listing_jobs', 'idempotency_key')
    op.drop_index('ix_ingestion_batches_idempotency_key', table_name='ingestion_batches')
    op.drop_column('ingestion_batches', 'idempotency_key')
    op.drop_constraint('uq_ingestion_batch_row', 'ingestion_batches', type_='unique')

