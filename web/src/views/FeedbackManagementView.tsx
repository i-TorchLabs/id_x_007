"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Chip, Input, Label, Table, TextField, toast } from "@heroui/react";
import {
  manageAdvisorListApi,
  manageFeedbackExportApi,
  manageFeedbackListApi,
  type ManageAdvisor,
  type ManageFeedback,
} from "@/api/admin";
import { useUserStore } from "@/context/UserContext";
import Paginator from "@/components/pa/Paginator";
import SelectField from "@/components/pa/SelectField";
import { downloadBase64 } from "@/utils/download";
import { isTrue } from "@/utils/format";

const PAGE_SIZE = 20;
const ALL = "__all__";

/** D-4 咨询反馈：顾问 / 月份筛选 + 导出 */
export default function FeedbackManagementView() {
  const t = useTranslations("feedback");
  // 数据域：advisor 仅见本人反馈（后端强制），不展示顾问筛选
  const { state: userState } = useUserStore();
  const isAdminUser = userState.role === "admin";
  const [loading, setLoading] = useState(false);
  const [advisors, setAdvisors] = useState<ManageAdvisor[]>([]);
  const [advisorId, setAdvisorId] = useState(ALL);
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<ManageFeedback[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isAdminUser) return;
    manageAdvisorListApi({ page: 1, pageSize: 100, keyword: "" })
      .then((res) => setAdvisors(res.list || []))
      .catch(() => undefined);
  }, [isAdminUser]);

  const getData = useCallback(
    async (pageNo = page, aid = advisorId, m = month) => {
      setLoading(true);
      try {
        const res = await manageFeedbackListApi({
          page: pageNo,
          pageSize: PAGE_SIZE,
          advisorId: aid === ALL ? "" : aid,
          month: m,
        });
        setData(res.list || []);
        setItemCount(Number(res.total) || 0);
      } catch (error) {
        toast.danger((error as Error).message || t("loadFail"));
        setData([]);
      }
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, advisorId, month]
  );

  useEffect(() => {
    getData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (aid = advisorId, m = month) => {
    setPage(1);
    getData(1, aid, m);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await manageFeedbackExportApi({
        advisorId: advisorId === ALL ? "" : advisorId,
        month,
      });
      downloadBase64(res.fileName, res.fileBase64);
    } catch (error) {
      toast.danger((error as Error).message || t("exportFail"));
    }
    setExporting(false);
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));

  const columns = [
    { id: "applyNo", name: t("column.applyNo") },
    { id: "advisorName", name: t("column.advisor") },
    { id: "student", name: t("column.student") },
    { id: "startTime", name: t("column.time") },
    { id: "topic", name: t("column.topic") },
    { id: "summary", name: t("column.summary") },
    { id: "handle", name: t("column.handle") },
    { id: "needFollowup", name: t("column.followup") },
  ];

  const advisorOptions = [
    { value: ALL, label: t("filter.allAdvisors") },
    ...advisors.map((a) => ({ value: String(a.advisorId), label: `${a.name} (${a.username})` })),
  ];

  return (
    <div>
      <div className="bg-white p-5 mb-2 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          {isAdminUser && (
            <SelectField
              label={t("filter.advisor")}
              value={advisorId}
              options={advisorOptions}
              onChange={(v) => {
                const next = v || ALL;
                setAdvisorId(next);
                handleSearch(next, month);
              }}
              className="w-56"
            />
          )}
          <TextField
            value={month}
            onChange={(v) => {
              setMonth(v);
              handleSearch(advisorId, v);
            }}
            aria-label={t("filter.month")}
          >
            <div className="flex items-center gap-2">
              <Label className="shrink-0">{t("filter.month")}</Label>
              <Input type="month" />
            </div>
          </TextField>
        </div>
        <Button variant="primary" isPending={exporting} onPress={handleExport}>
          {t("export")}
        </Button>
      </div>

      <Table aria-label={t("tableLabel")}>
        <Table.ScrollContainer>
          <Table.Content aria-label={t("dataTableLabel")}>
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Column id={col.id} isRowHeader={col.id === columns[0].id}>
                  {col.name}
                </Table.Column>
              )}
            </Table.Header>
            <Table.Body items={data} renderEmptyState={() => <div className="p-4">{t("noData")}</div>}>
              {(row) => (
                <Table.Row id={row.feedbackId} columns={columns}>
                  {(column: { id: string; name: string }) => {
                    switch (column.id) {
                      case "student":
                        return (
                          <Table.Cell>
                            <div className="text-sm">
                              <div>{row.studentName}</div>
                              <div className="text-xs text-gray-500">{row.studentNo}</div>
                            </div>
                          </Table.Cell>
                        );
                      case "summary":
                      case "handle":
                        return (
                          <Table.Cell>
                            <div className="max-w-[240px] truncate" title={String(row[column.id] ?? "")}>
                              {String(row[column.id] ?? "")}
                            </div>
                          </Table.Cell>
                        );
                      case "needFollowup":
                        return (
                          <Table.Cell>
                            {isTrue(row.needFollowup) ? (
                              <Chip color="warning">{t("needFollowup")}</Chip>
                            ) : (
                              <Chip>{t("no")}</Chip>
                            )}
                          </Table.Cell>
                        );
                      default:
                        return (
                          <Table.Cell>
                            {String(row[column.id as keyof ManageFeedback] ?? "")}
                          </Table.Cell>
                        );
                    }
                  }}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Paginator page={page} totalPages={totalPages} loading={loading} onChange={handlePageChange} />
    </div>
  );
}
