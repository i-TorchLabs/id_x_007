"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { Button, Input, Label, Modal, Table, TextField, toast } from "@heroui/react";
import {
  manageAdvisorListApi,
  manageAppointmentExportApi,
  manageAppointmentListApi,
  type ManageAdvisor,
  type ManageAppointment,
} from "@/api/admin";
import Paginator from "@/components/pa/Paginator";
import { AppointmentStateChip } from "@/components/pa/StateChip";
import SelectField from "@/components/pa/SelectField";
import { downloadBase64 } from "@/utils/download";

const PAGE_SIZE = 20;
const ALL = "__all__";

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <span className="break-all whitespace-pre-wrap">{value || "-"}</span>
    </div>
  );
}

/** D-3 预约总览：顾问 / 日期 / 状态筛选 + 详情 + 导出 */
export default function AppointmentManagementView() {
  const t = useTranslations("appointmentManagement");
  const [loading, setLoading] = useState(false);
  const [advisors, setAdvisors] = useState<ManageAdvisor[]>([]);
  const [advisorId, setAdvisorId] = useState(ALL);
  const [date, setDate] = useState("");
  const [stateFilter, setStateFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<ManageAppointment[]>([]);
  const [exporting, setExporting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ManageAppointment | null>(null);

  useEffect(() => {
    manageAdvisorListApi({ page: 1, pageSize: 100, keyword: "" })
      .then((res) => setAdvisors(res.list || []))
      .catch(() => undefined);
  }, []);

  const getData = useCallback(
    async (pageNo = page, aid = advisorId, d = date, st = stateFilter) => {
      setLoading(true);
      try {
        const res = await manageAppointmentListApi({
          page: pageNo,
          pageSize: PAGE_SIZE,
          advisorId: aid === ALL ? "" : aid,
          date: d,
          state: st === ALL ? "" : st,
        });
        setData(res.list || []);
        setItemCount(Number(res.total) || 0);
      } catch (error) {
        toast.danger((error as Error).message || t("loadFailed"));
        setData([]);
      }
      setLoading(false);
    },
    [page, advisorId, date, stateFilter]
  );

  useEffect(() => {
    getData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (aid = advisorId, d = date, st = stateFilter) => {
    setPage(1);
    getData(1, aid, d, st);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // 导出遵循当前顾问筛选；月份取自所选日期（契约导出维度为月）
      const res = await manageAppointmentExportApi({
        advisorId: advisorId === ALL ? "" : advisorId,
        month: date ? dayjs(date).format("YYYY-MM") : "",
      });
      downloadBase64(res.fileName, res.fileBase64);
    } catch (error) {
      toast.danger((error as Error).message || t("exportFailed"));
    }
    setExporting(false);
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));

  const columns = [
    { id: "applyNo", name: t("colApplyNo") },
    { id: "advisorName", name: t("colAdvisor") },
    { id: "student", name: t("colStudent") },
    { id: "time", name: t("colTime") },
    { id: "topic", name: t("colTopic") },
    { id: "mode", name: t("colMode") },
    { id: "state", name: t("colState") },
    { id: "actions", name: t("colOptions") },
  ];

  const advisorOptions = [
    { value: ALL, label: t("allAdvisors") },
    ...advisors.map((a) => ({ value: String(a.advisorId), label: `${a.name} (${a.username})` })),
  ];

  const stateOptions = [
    { value: ALL, label: t("stateAll") },
    { value: "booked", label: t("stateBooked") },
    { value: "completed", label: t("stateCompleted") },
    { value: "cancelled_student", label: t("stateCancelledStudent") },
    { value: "cancelled_advisor", label: t("stateCancelledAdvisor") },
  ];

  /** 咨询方式展示词（后端值 online/offline → 本地化文案） */
  const modeLabel = (m?: string) =>
    m === "online" ? t("modeOnline") : m === "offline" ? t("modeOffline") : (m ?? "");

  return (
    <div>
      <div className="bg-white p-5 mb-2 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <SelectField
            label={t("filterAdvisor")}
            value={advisorId}
            options={advisorOptions}
            onChange={(v) => {
              const next = v || ALL;
              setAdvisorId(next);
              handleSearch(next, date, stateFilter);
            }}
            className="w-56"
          />
          <TextField
            value={date}
            onChange={(v) => {
              setDate(v);
              handleSearch(advisorId, v, stateFilter);
            }}
            aria-label={t("dateLabel")}
          >
            <div className="flex items-center gap-2">
              <Label className="shrink-0">{t("dateLabel")}</Label>
              <Input type="date" />
            </div>
          </TextField>
          <SelectField
            label={t("filterState")}
            value={stateFilter}
            options={stateOptions}
            onChange={(v) => {
              const next = v || ALL;
              setStateFilter(next);
              handleSearch(advisorId, date, next);
            }}
          />
        </div>
        <Button variant="primary" isPending={exporting} onPress={handleExport}>
          {t("exportButton")}
        </Button>
      </div>

      <Table aria-label={t("ariaAppointmentList")}>
        <Table.ScrollContainer>
          <Table.Content aria-label={t("ariaDataTable")}>
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Column id={col.id} isRowHeader={col.id === columns[0].id}>
                  {col.name}
                </Table.Column>
              )}
            </Table.Header>
            <Table.Body items={data} renderEmptyState={() => <div className="p-4">{t("empty")}</div>}>
              {(row) => (
                <Table.Row id={row.appointmentId} columns={columns}>
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
                      case "time":
                        return (
                          <Table.Cell>
                            <div className="text-xs">
                              <div>{row.startTime}</div>
                              <div>~ {row.endTime}</div>
                            </div>
                          </Table.Cell>
                        );
                      case "mode":
                        return <Table.Cell className="capitalize">{modeLabel(row.mode)}</Table.Cell>;
                      case "state":
                        return (
                          <Table.Cell>
                            <AppointmentStateChip state={row.state} />
                          </Table.Cell>
                        );
                      case "actions":
                        return (
                          <Table.Cell>
                            <Button size="sm" onPress={() => setDetailTarget(row)}>
                              {t("detail")}
                            </Button>
                          </Table.Cell>
                        );
                      default:
                        return (
                          <Table.Cell>
                            {String(row[column.id as keyof ManageAppointment] ?? "")}
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

      <Modal isOpen={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <Modal.Backdrop>
          <Modal.Container placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("detailTitle")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-col gap-2">
                  <DetailRow label={t("detailApplyNo")} value={detailTarget?.applyNo} />
                  <DetailRow label={t("detailAdvisor")} value={detailTarget?.advisorName} />
                  <DetailRow
                    label={t("detailStudent")}
                    value={`${detailTarget?.studentName ?? ""} ${detailTarget?.studentNo ?? ""}`}
                  />
                  <DetailRow
                    label={t("detailTime")}
                    value={`${detailTarget?.startTime ?? ""} ~ ${detailTarget?.endTime ?? ""}`}
                  />
                  <DetailRow label={t("detailTopic")} value={detailTarget?.topic} />
                  <DetailRow label={t("detailContent")} value={detailTarget?.content} />
                  <DetailRow label={t("detailMode")} value={modeLabel(detailTarget?.mode)} />
                  <DetailRow label={t("detailPhone")} value={detailTarget?.phone} />
                  <DetailRow label={t("detailWechat")} value={detailTarget?.wechat} />
                  <DetailRow label={t("detailMeetingLink")} value={detailTarget?.meetingLink} />
                  <DetailRow label={t("detailCancelReason")} value={detailTarget?.cancelReason} />
                  <DetailRow label={t("detailCreatedAt")} value={detailTarget?.createTime} />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDetailTarget(null)}>
                  {t("close")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
