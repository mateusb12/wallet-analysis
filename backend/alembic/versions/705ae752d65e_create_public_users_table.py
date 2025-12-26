"""create_public_users_table

Revision ID: 705ae752d65e
Revises: 3a4bdcf67ec9
Create Date: 2025-12-26 17:48:08.783929

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '705ae752d65e'
down_revision: Union[str, Sequence[str], None] = '3a4bdcf67ec9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Criação da tabela (Gerado automaticamente)
    op.create_table('users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['id'], ['auth.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Segurança (RLS) e Policies
    op.execute("ALTER TABLE public.users ENABLE ROW LEVEL SECURITY")

    # Policy: Todos podem ler (necessário para mostrar avatar publicamente se quiser)
    op.execute("""
        CREATE POLICY "Public profiles are viewable by everyone" 
        ON public.users FOR SELECT 
        USING (true);
    """)

    # Policy: Apenas o dono pode atualizar
    op.execute("""
        CREATE POLICY "Users can update own profile" 
        ON public.users FOR UPDATE 
        USING (auth.uid() = id);
    """)

    # 3. Trigger Function (Copia dados do auth.users para public.users ao criar conta)
    op.execute("""
        CREATE OR REPLACE FUNCTION public.handle_new_user() 
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO public.users (id, email, full_name, avatar_url)
            VALUES (
                new.id, 
                new.email, 
                new.raw_user_meta_data->>'full_name', 
                new.raw_user_meta_data->>'avatar_url'
            );
            RETURN new;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # 4. Trigger (Vincula a função ao evento de INSERT no auth.users)
    op.execute("""
        CREATE OR REPLACE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    """)


def downgrade() -> None:
    # Remove trigger e função (Importante remover pois estão no schema auth/public global)
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users")
    op.execute("DROP FUNCTION IF EXISTS public.handle_new_user")

    # Remove tabela
    op.drop_table('users')