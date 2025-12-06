"""add tenant onboarding fields

Revision ID: tenant_onboarding_001
Revises: 2f8a3c4d9e5b
Create Date: 2025-12-02 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'tenant_onboarding_001'
down_revision = '2f8a3c4d9e5b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add description column to tenants table
    op.add_column('tenants', sa.Column('description', sa.Text(), nullable=True))
    
    # Add onboarding_completed column to tenants table
    op.add_column('tenants', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove columns if we need to rollback
    op.drop_column('tenants', 'onboarding_completed')
    op.drop_column('tenants', 'description')

