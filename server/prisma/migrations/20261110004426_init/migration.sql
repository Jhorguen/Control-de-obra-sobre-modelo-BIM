-- CreateEnum
CREATE TYPE "ModelFileKind" AS ENUM ('IFC', 'FRAG');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('M3', 'M2', 'M', 'KG', 'UN');

-- CreateEnum
CREATE TYPE "QuantitySource" AS ENUM ('VOLUME', 'AREA', 'LENGTH', 'COUNT');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_files" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "kind" "ModelFileKind" NOT NULL,
    "file_name" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elements" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "global_id" TEXT NOT NULL,
    "ifc_class" TEXT NOT NULL,
    "name" TEXT,
    "type_name" TEXT,
    "level" TEXT,
    "volume" DOUBLE PRECISION,
    "area" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "planned_date" DATE,
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "description" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "quantity_source" "QuantitySource" NOT NULL,
    "factor" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(16,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "element_budget_items" (
    "element_id" INTEGER NOT NULL,
    "budget_item_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_budget_items_pkey" PRIMARY KEY ("element_id","budget_item_id")
);

-- CreateTable
CREATE TABLE "progress_records" (
    "id" SERIAL NOT NULL,
    "element_id" INTEGER NOT NULL,
    "status" "ProgressStatus" NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_files_project_id_kind_key" ON "model_files"("project_id", "kind");

-- CreateIndex
CREATE INDEX "elements_project_id_ifc_class_idx" ON "elements"("project_id", "ifc_class");

-- CreateIndex
CREATE INDEX "elements_project_id_level_idx" ON "elements"("project_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "elements_project_id_global_id_key" ON "elements"("project_id", "global_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_items_project_id_code_key" ON "budget_items"("project_id", "code");

-- CreateIndex
CREATE INDEX "element_budget_items_budget_item_id_idx" ON "element_budget_items"("budget_item_id");

-- CreateIndex
CREATE INDEX "progress_records_element_id_date_created_at_idx" ON "progress_records"("element_id", "date" DESC, "created_at" DESC);

-- AddForeignKey
ALTER TABLE "model_files" ADD CONSTRAINT "model_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_budget_items" ADD CONSTRAINT "element_budget_items_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_budget_items" ADD CONSTRAINT "element_budget_items_budget_item_id_fkey" FOREIGN KEY ("budget_item_id") REFERENCES "budget_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
