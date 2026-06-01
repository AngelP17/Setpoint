use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize)]
pub struct ApiErrorBody {
    pub error: &'static str,
    pub detail: String,
}

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub body: ApiErrorBody,
}

impl ApiError {
    pub fn new(status: StatusCode, error: &'static str, detail: impl fmt::Display) -> Self {
        Self {
            status,
            body: ApiErrorBody {
                error,
                detail: detail.to_string(),
            },
        }
    }

    pub fn internal(detail: impl fmt::Display) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", detail)
    }

    pub fn not_found(detail: impl fmt::Display) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", detail)
    }

    pub fn bad_request(detail: impl fmt::Display) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "bad_request", detail)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (self.status, Json(self.body)).into_response()
    }
}

impl From<kube::Error> for ApiError {
    fn from(err: kube::Error) -> Self {
        let detail = err.to_string();
        match &err {
            kube::Error::Api(api_err) if api_err.code == 404 => {
                Self::not_found(format!("Resource not found: {detail}"))
            }
            _ => Self::internal(format!("Kubernetes API error: {detail}")),
        }
    }
}
