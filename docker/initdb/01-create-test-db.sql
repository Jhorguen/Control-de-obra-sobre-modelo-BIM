-- Runs only when the PostgreSQL volume is created for the first time.
-- Separate database for the API tests, which truncate every table.
CREATE DATABASE bim_test OWNER bim;
