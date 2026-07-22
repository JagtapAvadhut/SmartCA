package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// Connect establishes a connection to PostgreSQL
func Connect(connStr string, maxOpenConns, maxIdleConns int, connMaxLifetimeMinutes int) (*sql.DB, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if maxOpenConns <= 0 {
		maxOpenConns = 50
	}
	if maxIdleConns <= 0 {
		maxIdleConns = 10
	}
	if connMaxLifetimeMinutes <= 0 {
		connMaxLifetimeMinutes = 5
	}

	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(maxIdleConns)
	db.SetConnMaxLifetime(time.Duration(connMaxLifetimeMinutes) * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}
