"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertDialog, Button, Modal, Table, toast } from "@heroui/react";
import {
  advisorAppointmentCancelApi,
  advisorAppointmentCompleteApi,
  advisorMyAppointmentListApi,
  advisorMyExportApi,
  feedbackSetApi,
  type AdvisorAppointment,
} from "@/api/advisor";
import Paginator from "@/components/pa/Paginator";
import { AppointmentStateChip } from "@/components/pa/StateChip";
import SelectField from "@/components/pa/SelectField";
import SwitchField from "@/components/pa/SwitchField";
import FormField from "@/components/pa/FormField";
import { downloadBase64 } from "@/utils/download";
import { isTrue } from "@/utils/format";

const PAGE_SIZE = 20;
const ALL = "__all__";

/** 详情弹窗里的只读行 */
function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <span className="break-all whitespace-pre-wrap">{value || "-"}</span>
    </div>
  );
}

export default function AdvisorAppointmentsView() {
  const t = useTranslations("advisorAppointments");
  const [loading, setLoading] = useState(false);
  const [stateFilter, setStateFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<AdvisorAppointment[]>([]);
  const [exporting, setExporting] = useState(false);

  const [detailTarget, setDetailTarget] = useState<AdvisorAppointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdvisorAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [completeTarget, setCompleteTarget] = useState<AdvisorAppointment | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<AdvisorAppointment | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    summary: "",
    handle: "",
    needFollowup: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const getData = useCallback(
    async (pageNo = page, state = stateFilter) => {
      setLoading(true);
      try {
        const res = await advisorMyAppointmentListApi({
          page: pageNo,
          pageSize: PAGE_SIZE,
          state: state === ALL ? "" : state,
        });
        setData(res.list || []);
        setItemCount(Number(res.total) || 0);
      } catch (error) {
        toast.danger((error as Error).message || t("loadFailed"));
        setData([]);
      }
      setLoading(false);
    },
    [page, stateFilter]
  );

  useEffect(() => {
    getData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStateFilterChange = (v: string) => {
    const next = v || ALL;
    setStateFilter(next);
    setPage(1);
    getData(1, next);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await advisorMyExportApi();
      downloadBase64(res.fileName, res.fileBase64);
    } catch (error) {
      toast.danger((error as Error).message || t("exportFailed"));
    }
    setExporting(false);
  };

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    try {
      await advisorAppointmentCancelApi(cancelTarget.appointmentId, cancelReason.trim());
      toast.success(t("cancelledSuccess"));
      setCancelTarget(null);
      setCancelReason("");
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("cancelFailed"));
    }
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    try {
      await advisorAppointmentCompleteApi(completeTarget.appointmentId);
      toast.success(t("completeSuccess"));
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("completeFailed"));
    }
  };

  const openFeedback = (row: AdvisorAppointment) => {
    setFeedbackTarget(row);
    // 已有反馈时回显
    if (isTrue(row.hasFeedback)) {
      setFeedbackForm({
        summary: row.feedbackSummary || "",
        handle: row.feedbackHandle || "",
        needFollowup: isTrue(row.feedbackNeedFollowup),
      });
    } else {
      setFeedbackForm({ summary: "", handle: "", needFollowup: false });
    }
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
      });
      toast.success(t("feedbackSaved"));
      setFeedbackTarget(null);
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("feedbackSaveFailed"));
    }
    setSubmitting(false);
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));

  const stateOptions = [
    { value: ALL, label: t("stateAll") },
    { value: "booked", label: t("stateBooked") },
    { value: "completed", label: t("stateCompleted") },
    { value: "cancelled_student", label: t("stateCancelledStudent") },
    { value: "cancelled_advisor", label: t("stateCancelledAdvisor") },
  ];

  const columns = [
    { id: "applyNo", name: t("colApplyNo") },
    { id: "student", name: t("colStudent") },
    { id: "time", name: t("colTime") },
    { id: "topic", name: t("colTopic") },
    { id: "mode", name: t("colMode") },
    { id: "state", name: t("colState") },
    { id: "actions", name: t("colOptions") },
  ];

  /** 咨询方式展示词（后端值 online/offline → 本地化文案） */
  const modeLabel = (m?: string) =>
    m === "online" ? t("modeOnline") : m === "offline" ? t("modeOffline") : (m ?? "");

  return (
    <div>
      {/* 工具栏：状态筛选 + 导出 */}
      <div className="bg-white p-5 mb-2 flex items-center justify-between flex-wrap gap-3">
        <SelectField
          label={t("filterState")}
          value={stateFilter}
          options={stateOptions}
          onChange={handleStateFilterChange}
        />
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
                                <Button size="sm" variant="secondary" onPress={() => openFeedback(row)}>
                                  {t("feedback")}
                                </Button>
                              )}
                            </div>
                          </Table.Cell>
                        );
                      default:
                        return (
                          <Table.Cell>
                            {String(row[column.id as keyof AdvisorAppointment] ?? "")}
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

      {/* 详情弹窗 */}
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

      {/* 取消预约：必填取消原因 */}
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
                <Button variant="danger" isDisabled={!cancelReason.trim()} onPress={handleCancel}>
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
                <Button
                  variant="primary"
                  onPress={() => {
                    setCompleteTarget(null);
                    handleComplete();
                  }}
                >
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
