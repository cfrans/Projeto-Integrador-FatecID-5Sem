class DiagnosticError(Exception):
    def __init__(
        self,
        message: str,
        code: int,
        *,
        category: str = "configuration",
        retryable: bool = False,
        retry_after: float | None = None,
        http_status: int | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.category = category
        self.retryable = retryable
        self.retry_after = retry_after
        self.http_status = http_status
