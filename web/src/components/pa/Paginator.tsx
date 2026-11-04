"use client";

import { Pagination } from "@heroui/react";
import { getVisiblePages } from "@/utils/pagination";

interface PaginatorProps {
  page: number;
  totalPages: number;
  loading?: boolean;
  onChange: (page: number) => void;
}

/** 表格底部分页条（统一范式：上一页 / 窗口页码 / 下一页） */
export default function Paginator({ page, totalPages, loading, onChange }: PaginatorProps) {
  const handleChange = (newPage: number) => {
    if (loading || newPage < 1 || newPage > totalPages || newPage === page) return;
    onChange(newPage);
  };

  return (
    <div className="flex justify-end p-4 bg-white">
      <Pagination aria-label="pagination">
        <Pagination.Summary>
          {page} / {totalPages}
        </Pagination.Summary>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous
              onPress={() => handleChange(page - 1)}
              isDisabled={page <= 1 || !!loading}
            >
              <Pagination.PreviousIcon />
            </Pagination.Previous>
          </Pagination.Item>
          {getVisiblePages(totalPages, page).map((n, idx) =>
            n === "ellipsis" ? (
              <Pagination.Item key={`e-${idx}`}>
                <span className="px-2">...</span>
              </Pagination.Item>
            ) : (
              <Pagination.Item key={n}>
                <Pagination.Link isActive={n === page} onPress={() => handleChange(n)}>
                  {n}
                </Pagination.Link>
              </Pagination.Item>
            )
          )}
          <Pagination.Item>
            <Pagination.Next
              onPress={() => handleChange(page + 1)}
              isDisabled={page >= totalPages || !!loading}
            >
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </div>
  );
}
