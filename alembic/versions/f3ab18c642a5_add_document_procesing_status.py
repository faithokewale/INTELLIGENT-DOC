from alembic import op
import sqlalchemy as sa


revision = "f3ab18c642a5"
down_revision = "d3fd2665c584"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "documents",
        sa.Column(
            "processing_status",
            sa.String(length=20),
            nullable=False,
            server_default="completed",
        ),
    )

    op.alter_column(
        "documents",
        "processing_status",
        server_default="pending",
    )


def downgrade():
    op.drop_column("documents", "processing_status")