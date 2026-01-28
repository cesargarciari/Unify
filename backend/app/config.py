import os

class Settings:
    """
    Simple settings object for our backend.

    We intentionally avoid pydantic.BaseSettings here to keep things
    compatible with both Pydantic v1 and v2 and avoid extra deps.
    """

    def __init__(self) -> None:
        # If DATABASE_URL is not set in the environment, fall back to
        # the Docker Compose Postgres service.
        self.database_url: str = os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:postgres@db/unify",
        )

settings = Settings()
