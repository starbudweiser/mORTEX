import React, { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { TextField } from "@/ui/components/form/text_field/TextField";

import type { IPaginationProps } from "./Pagination";

export const JumpToPage = ({
  currentPage,
  onPaginationUpdate,
  recordsPerPage,
  totalPages,
}: Pick<IPaginationProps, "currentPage" | "onPaginationUpdate" | "recordsPerPage"> & {
  totalPages: number;
}) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(currentPage);
  const [prevCurrentPage, setPrevCurrentPage] = useState(currentPage);

  if (currentPage !== prevCurrentPage) {
    setPrevCurrentPage(currentPage);
    setPage(currentPage);
  }

  const isValid = Number.isInteger(page) && page >= 1 && page <= totalPages;

  const handleSubmit = (event: FormEvent) => {
    if (isValid) {
      onPaginationUpdate(page, recordsPerPage);
    }

    event.preventDefault();
  };

  return (
    <form className="nxm-pagination-page" onSubmit={handleSubmit}>
      <div className="nxm-pagination-page-label">{t("Page")}</div>

      <TextField
        className="nxm-pagination-page-input"
        errorMessage={
          !isValid ? t("Enter a page between 1 and {{total}}", { total: totalPages }) : undefined
        }
        hideErrors={true}
        hideLabel={true}
        label={t("Jump to page")}
        max={totalPages}
        min={1}
        pattern="[0-9]*"
        type="number"
        value={page}
        onChange={(e) => {
          if (!Number.isNaN(e.target.valueAsNumber)) {
            setPage(e.target.valueAsNumber);
          }
        }}
      />

      <Button aria-disabled={!isValid} brand="neutral" appearance="moderate" type="submit">
        Go
      </Button>
    </form>
  );
};
