package com.viajes.web;

/** Error de negocio con estado HTTP explicito (404, 409, 400...). */
public class ApiException extends RuntimeException {

    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
