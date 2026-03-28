package handlers

import "net/http"

// HTTPStatusError carries an HTTP status for GoFr handlers that implement gofr/http.StatusCodeResponder.
type HTTPStatusError struct {
	Code    int
	Message string
}

func (e HTTPStatusError) Error() string {
	return e.Message
}

// StatusCode returns the HTTP status to send to the client.
func (e HTTPStatusError) StatusCode() int {
	if e.Code == 0 {
		return http.StatusInternalServerError
	}
	return e.Code
}
