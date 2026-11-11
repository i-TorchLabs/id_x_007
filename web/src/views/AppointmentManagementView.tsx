"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { AlertDialog, Button, Input, Label, Modal, Table, TextField, toast } from "@heroui/react";
import {
  manageAdvisorListApi,
  manageAppointmentExportApi,
  manageAppointmentListApi,
  type ManageAdvisor,
  type ManageAppointment,
} from "@/api/admin";
import {
  advisorAppointmentCancelApi,
  advisorAppointmentCompleteApi,
  feedbackSetApi,
} from "@/api/advisor";
import Paginator from "@/components/pa/Paginator";
import { AppointmentStateChip } from "@/components/pa/StateChip";
import SelectField from "@/components/pa/SelectField";
import FormField from "@/components/pa/FormField";
import SwitchField from "@/components/pa/SwitchField";
import { downloadBase64 } from "@/utils/download";
import { isTrue } from "@/utils/format";

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
  const [cancelTarget, setCancelTarget] = useState<ManageAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [completeTarget, setCompleteTarget] = useState<ManageAppointment | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<ManageAppointment | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    summary: "",
    handle: "",
    needFollowup: false,
  });
  const [submitting, setSubmitting] = useState(false);

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

  /** 取消预约（管理端代顾问操作，须填原因） */
  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setSubmitting(true);
    try {
      await advisorAppointmentCancelApi(
        cancelTarget.appointmentId,
        cancelReason.trim(),
        cancelTarget.advisorId
      );
      toast.success(t("cancelledSuccess"));
      setCancelTarget(null);
      setCancelReason("");
      getData(page);
    } catch (error) {
      toast.danger((error as Error).message || t("cancelFailed"));
    }
    setSubmitting(false);
  };

  /** 标记完成 */
  const handleComplete = async () => {
    if (!completeTarget) return;
    setSubmitting(true);
    try {
      await advisorAppointmentCompleteApi(completeTarget.appointmentId, completeTarget.advisorId);
      toast.success(t("completeSuccess"));
      setCompleteTarget(null);
      getData(page);
    } catch (error) {
      toast.danger((error as Error).message || t("completeFailed"));
    }
    setSubmitting(false);
  };

  /** 打开反馈弹窗：已有反馈则回填 */
  const openFeedback = (row: ManageAppointment) => {
    setFeedbackForm({
      summary: row.feedbackSummary || "",
      handle: row.feedbackHandle || "",
      needFollowup: isTrue(row.feedbackNeedFollowup),
    });
    setFeedbackTarget(row);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackTarget) return;
    if (!feedbackForm.summary.trim()) {
      toast.danger(t("summaryRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await feedbackSetApi({
        appointmentId: feedbackTarget.appointmentId,
        summary: feedbackForm.summary.trim(),
        handle: feedbackForm.handle.trim(),
        needFollowup: feedbackForm.needFollowup,
        advisorId: feedbackTarget.advisorId,
      });
      toast.success(t("feedbackSaved"));
      setFeedbackTarget(null);
      getData(page);
    } catch (error) {
      toast.danger((error as Error).message || t("feedbackSaveFailed"));
    }
    setSubmitting(false);
  };

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
                              {row.studentEmail ? (
                                <div className="text-xs text-gray-500 break-all">{row.studentEmail}</div>
                              ) : null}
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
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onPress={() => setDetailTarget(row)}>
                                {t("detail")}
                              </Button>
                              {isTrue(row.cancelable) && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onPress={() => {
                                    setCancelReason("");
                                    setCancelTarget(row);
                                  }}
                                >
                                  {t("cancel")}
                                </Button>
                              )}
                              {isTrue(row.completable) && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onPress={() => setCompleteTarget(row)}
                                >
                                  {t("complete")}
                                </Button>
                              )}
                              {row.state === "completed" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => openFeedback(row)}
                                >
                                  {t("feedback")}
                                </Button>
                              )}
                            </div>
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
                  <DetailRow label={t("detailEmail")} value={detailTarget?.studentEmail} />
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
                  {isTrue(detailTarget?.hasFeedback) && (
                    <>
                      <DetailRow label={t("detailFeedbackSummary")} value={detailTarget?.feedbackSummary} />
                      <DetailRow label={t("detailFeedbackHandle")} value={detailTarget?.feedbackHandle} />
                      <DetailRow
                        label={t("detailNeedFollowup")}
                        value={isTrue(detailTarget?.feedbackNeedFollowup) ? t("yes") : t("no")}
                      />
                    </>
                  )}
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

      {/* 取消预约：代顾问取消，必填原因 */}
      <AlertDialog
        isOpen={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>{t("cancelTitle")}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <div className="mb-2">
                  {t("cancelBody", {
                    applyNo: cancelTarget?.applyNo ?? "",
                    studentName: cancelTarget?.studentName ?? "",
                  })}
                </div>
                <textarea
                  className="w-full h-20 rounded-lg border border-gray-300 p-2 text-sm"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t("cancelReasonPlaceholder")}
                />
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setCancelTarget(null);
                    setCancelReason("");
                  }}
                >
                  {t("back")}
                </Button>
                <Button
                  variant="danger"
                  isDisabled={!cancelReason.trim()}
                  isPending={submitting}
                  onPress={handleCancel}
                >
                  {t("confirm")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      {/* 标记完成 */}
      <AlertDialog
        isOpen={!!completeTarget}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>{t("completeTitle")}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                {t("completeBody", { applyNo: completeTarget?.applyNo ?? "" })}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" onPress={() => setCompleteTarget(null)}>
                  {t("back")}
                </Button>
                <Button variant="primary" isPending={submitting} onPress={handleComplete}>
                  {t("confirm")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      {/* 咨询反馈 */}
      <Modal isOpen={!!feedbackTarget} onOpenChange={(open) => !open && setFeedbackTarget(null)}>
        <Modal.Backdrop>
          <Modal.Container placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("feedbackTitle")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">{t("summaryLabel")}</div>
                    <textarea
                      className="w-full h-24 rounded-lg border border-gray-300 p-2 text-sm"
                      value={feedbackForm.summary}
                      onChange={(e) =>
                        setFeedbackForm((s) => ({ ...s, summary: e.target.value }))
                      }
                      placeholder={t("summaryPlaceholder")}
                    />
                  </div>
                  <FormField
                    label={t("handleLabel")}
                    value={feedbackForm.handle}
                    onChange={(v) => setFeedbackForm((s) => ({ ...s, handle: v }))}
                    placeholder={t("handlePlaceholder")}
                  />
                  <SwitchField
                    label={t("needFollowupLabel")}
                    checked={feedbackForm.needFollowup}
                    onChange={(v) => setFeedbackForm((s) => ({ ...s, needFollowup: v }))}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setFeedbackTarget(null)}>
                  {t("cancel")}
                </Button>
                <Button variant="primary" isPending={submitting} onPress={handleFeedbackSubmit}>
                  {t("submit")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
