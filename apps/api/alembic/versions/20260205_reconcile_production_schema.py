"""Reconcile production schema - add missing columns safely

Revision ID: 20260205_reconcile
Revises: c87d20a75a7b
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260205_reconcile'
down_revision = 'c87d20a75a7b'
branch_labels = None
depends_on = None


def upgrade():
    """Add all missing columns that production database needs"""
    
    # Import helper functions
    from app.db.migration_utils import add_column_if_not_exists
    
    # Add missing audit_logs columns
    add_column_if_not_exists('audit_logs', sa.Column('actor_user_id', sa.BigInteger()))
    add_column_if_not_exists('audit_logs', sa.Column('actor_email', sa.String(255)))
    add_column_if_not_exists('audit_logs', sa.Column('actor_ip', sa.String(50)))
    add_column_if_not_exists('audit_logs', sa.Column('http_method', sa.String(10)))
    add_column_if_not_exists('audit_logs', sa.Column('http_path', sa.String(500)))
    add_column_if_not_exists('audit_logs', sa.Column('http_status', sa.Integer()))
    add_column_if_not_exists('audit_logs', sa.Column('status', sa.String(20)))
    add_column_if_not_exists('audit_logs', sa.Column('error_message', sa.Text()))
    add_column_if_not_exists('audit_logs', sa.Column('request_metadata', postgresql.JSONB()))
    add_column_if_not_exists('audit_logs', sa.Column('response_metadata', postgresql.JSONB()))
    add_column_if_not_exists('audit_logs', sa.Column('attempt', sa.Integer(), server_default='1'))
    add_column_if_not_exists('audit_logs', sa.Column('latency_ms', sa.Integer()))
    
    # Add missing users columns
    add_column_if_not_exists('users', sa.Column('oauth_provider', sa.String(50)))
    
    # Add missing schedules columns
    add_column_if_not_exists('schedules', sa.Column('name', sa.String(255)))
    add_column_if_not_exists('schedules', sa.Column('description', sa.Text()))
    add_column_if_not_exists('schedules', sa.Column('type', sa.String(50)))
    add_column_if_not_exists('schedules', sa.Column('cron_expr', sa.String(100)))
    add_column_if_not_exists('schedules', sa.Column('daily_quota', sa.Integer(), server_default='150'))
    add_column_if_not_exists('schedules', sa.Column('weekly_quota', sa.Integer()))
    add_column_if_not_exists('schedules', sa.Column('daily_used', sa.Integer(), server_default='0'))
    add_column_if_not_exists('schedules', sa.Column('weekly_used', sa.Integer(), server_default='0'))
    add_column_if_not_exists('schedules', sa.Column('last_daily_reset', sa.DateTime(timezone=True)))
    add_column_if_not_exists('schedules', sa.Column('last_weekly_reset', sa.DateTime(timezone=True)))
    add_column_if_not_exists('schedules', sa.Column('last_run_at', sa.DateTime(timezone=True)))
    add_column_if_not_exists('schedules', sa.Column('next_run_at', sa.DateTime(timezone=True)))
    add_column_if_not_exists('schedules', sa.Column('last_error', sa.Text()))
    add_column_if_not_exists('schedules', sa.Column('execution_count', sa.Integer(), server_default='0'))
    add_column_if_not_exists('schedules', sa.Column('total_success', sa.Integer(), server_default='0'))
    add_column_if_not_exists('schedules', sa.Column('total_failed', sa.Integer(), server_default='0'))
    
    # Add missing listing_jobs columns
    add_column_if_not_exists('listing_jobs', sa.Column('status', sa.String(20), server_default='pending'))


def downgrade():
    """Downgrade not supported for reconciliation migration"""
    pass
