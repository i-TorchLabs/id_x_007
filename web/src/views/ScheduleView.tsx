"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertDialog, Button, Chip, Modal, Table, toast } from "@heroui/react";
import {
  advisorAcceptingSetApi,
  advisorMySlotListApi,
  advisorSlotBatchUploadApi,
  advisorSlotCancelApi,
  advisorSlotCreateApi,
  advisorSlotDefListApi,
  advisorSlotDeleteApi,
  advisorSlotStateApi,
  advisorSlotTemplateApi,
  advisorSlotUpdateApi,
  type MySlot,
  type SlotBatchUploadRes,
  type SlotDef,
  type SlotFormValue,
} from "@/api/advisor";
import Paginator from "@/components/pa/Paginator";
import { SlotStateChip } from "@/components/pa/StateChip";
import SwitchField from "@/components/pa/SwitchField";
import SelectField from "@/components/pa/SelectField";
import { downloadBase64 } from "@/utils/download";
import { isTrue } from "@/utils/format";

const PAGE_SIZE = 20;

/** 取消截止（小时）：开始前 4 小时内不可取消（与后端 CANCEL_DEADLINE_HOURS 一致，后端仍兜底校验） */
const CANCEL_DEADLINE_HOURS = 4;

/** 时段是否仍可取消：距开始 > 4 小时 */
const slotCancelable = (row: MySlot) =>
  Date.now() < Number(row.startTimeMs) - CANCEL_DEADLINE_HOURS * 3600 * 1000;

const emptyForm: SlotFormValue = {
  weekday: "1",
  slotDefId: "",
};

/** 星期选项（1=周一 ... 7=周日，与后端 weekday 对齐） */
const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

interface ScheduleViewProps {
  /** admin 代管（D-2）时传目标顾问 id；advisor 本人（C-1）留空（接口层转 0） */
  advisorId?: string;
  /** 提供时每行显示「预览」按钮（管理端代管页用：预览学生端效果） */
  onPreview?: (row: MySlot) => void;
}

export default function ScheduleView({ advisorId = "", onPreview }: ScheduleViewProps) {
  const t = useTranslations("schedule");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<MySlot[]>([]);
  // 「接待中」真实值来自 advisorMySlotList 响应顶层 accepting（"1"/"0"）
  const [accepting, setAccepting] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState("");
  const [formValue, setFormValue] = useState<SlotFormValue>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MySlot | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MySlot | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [uploadResult, setUploadResult] = useState<SlotBatchUploadRes | null>(null);
  const [slotDefs, setSlotDefs] = useState<SlotDef[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getData = useCallback(
    async (pageNo = page) => {
      setLoading(true);
      try {
        const res = await advisorMySlotListApi({ page: pageNo, pageSize: PAGE_SIZE, advisorId });
        setData(res.list || []);
        setItemCount(Number(res.total) || 0);
        setAccepting(isTrue(res.accepting));
      } catch (error) {
        toast.danger((error as Error).message || t("loadFail"));
        setData([]);
      }
      setLoading(false);
    },
    [page, advisorId]
  );

  useEffect(() => {
    getData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisorId]);

  useEffect(() => {
    advisorSlotDefListApi()
      .then((res) => setSlotDefs(res.list || []))
      .catch((error) => toast.danger((error as Error).message || t("loadFail")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const openModal = (row?: MySlot) => {
    if (row) {
      setIsEdit(true);
      setEditId(row.slotId);
      setFormValue({
        weekday: String(row.weekday),
        slotDefId: String(row.slotDefId),
      });
    } else {
      setIsEdit(false);
      setEditId("");
      setFormValue(emptyForm);
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formValue.weekday || !formValue.slotDefId) {
      toast.danger(t("slotRequired"));
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await advisorSlotUpdateApi({ ...formValue, slotId: editId, advisorId });
      } else {
        await advisorSlotCreateApi({ ...formValue, advisorId });
      }
      toast.success(t("saved"));
      setModalOpen(false);
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("saveFail"));
    }
    setSubmitting(false);
  };

  // state: "1" 开放 / "0" 暂停
  const handleToggleState = async (row: MySlot) => {
    const next = row.state === "0" ? "1" : "0";
    try {
      await advisorSlotStateApi(row.slotId, next, advisorId);
      toast.success(next === "0" ? t("slotPaused") : t("slotResumed"));
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("stateFail"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await advisorSlotDeleteApi(deleteTarget.slotId, advisorId);
      toast.success(t("deleted"));
      getData();
    } catch (error) {
      // 时段已有预约时后端拒绝删除，这里透出后端 msg
      toast.danger((error as Error).message || t("deleteFail"));
    }
  };

  const closeCancelDialog = () => {
    setCancelTarget(null);
    setCancelReason("");
  };

  // 取消时段：已预约学生逐条取消并邮件通知（抄送顾问本人）；4 小时截止由后端兜底
  const handleCancelSlot = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await advisorSlotCancelApi(cancelTarget.slotId, cancelReason.trim(), advisorId);
      toast.success(t("slotCancelled", { count: Number(res?.cancelledCount) || 0 }));
      closeCancelDialog();
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("cancelSlotFail"));
    }
    setCancelling(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await advisorSlotTemplateApi();
      downloadBase64(res.fileName, res.fileBase64);
    } catch (error) {
      toast.danger((error as Error).message || t("templateFail"));
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const res = await advisorSlotBatchUploadApi(file, advisorId);
      // 有逐行错误时弹结果 Modal，否则仅 toast 计数
      if (res?.errors?.length) {
        setUploadResult(res);
      } else {
        toast.success(t("uploadFinished", { success: res?.success ?? 0, fail: res?.fail ?? 0 }));
      }
      setPage(1);
      getData(1);
    } catch (error) {
      toast.danger((error as Error).message || t("uploadFail"));
    }
  };

  const handleAcceptingChange = async (next: boolean) => {
    const prev = accepting;
    setAccepting(next);
    try {
      await advisorAcceptingSetApi(next, advisorId);
      toast.success(next ? t("acceptingOnToast") : t("acceptingOffToast"));
    } catch (error) {
      setAccepting(prev);
      toast.danger((error as Error).message || t("updateFail"));
    }
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));

  const columns = [
    { id: "weekday", name: t("weekday") },
    { id: "startClock", name: t("startTime") },
    { id: "endClock", name: t("endTime") },
    { id: "booked", name: t("bookedState") },
    { id: "state", name: t("state") },
    { id: "actions", name: t("options") },
  ];

  return (
    <div>
      {/* 工具栏：新增 / 模板下载 / 批量上传 / 接待开关 */}
      <div className="bg-white p-5 mb-2 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="primary" onPress={() => openModal()}>
            {t("addSlot")}
          </Button>
          <Button onPress={handleDownloadTemplate}>{t("downloadTemplate")}</Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <Button onPress={() => fileInputRef.current?.click()}>{t("batchUpload")}</Button>
        </div>
        <SwitchField
          label={accepting ? t("acceptingOn") : t("acceptingOff")}
          checked={accepting}
          onChange={handleAcceptingChange}
        />
      </div>

      <Table aria-label={t("tableLabel")}>
        <Table.ScrollContainer>
          <Table.Content aria-label={t("tableAria")}>
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Column id={col.id} isRowHeader={col.id === columns[0].id}>
                  {col.name}
                </Table.Column>
              )}
            </Table.Header>
            <Table.Body items={data} renderEmptyState={() => <div className="p-4">{t("noData")}</div>}>
              {(row) => (
                <Table.Row id={row.slotId} columns={columns}>
                  {(column: { id: string; name: string }) => {
                    switch (column.id) {
                      case "weekday":
                        return <Table.Cell>{row.weekdayLabel}</Table.Cell>;
                      case "startClock":
                        return <Table.Cell>{row.startClock}</Table.Cell>;
                      case "endClock":
                        return <Table.Cell>{row.endClock}</Table.Cell>;
                      case "booked":
                        return (
                          <Table.Cell>
                            {Number(row.booked) > 0 ? (
                              <Chip color="warning">{t("slotBooked")}</Chip>
                            ) : (
                              <Chip color="success">{t("slotAvailable")}</Chip>
                            )}
                          </Table.Cell>
                        );
                      case "state":
                        return (
                          <Table.Cell>
                            <SlotStateChip state={row.state} />
                          </Table.Cell>
                        );
                      case "actions":
                        return (
                          <Table.Cell>
                            {onPreview && (
                              <Button
                                size="sm"
                                className="mr-2"
                                onPress={() => onPreview(row)}
                              >
                                {t("preview")}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="primary"
                              className="mr-2"
                              onPress={() => openModal(row)}
                            >
                              {t("edit")}
                            </Button>
                            <Button
                              size="sm"
                              className="mr-2"
                              onPress={() => handleToggleState(row)}
                            >
                              {row.state === "0" ? t("resume") : t("pause")}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              className="mr-2"
                              isDisabled={!slotCancelable(row)}
                              onPress={() => setCancelTarget(row)}
                            >
                              {t("cancelSlot")}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onPress={() => setDeleteTarget(row)}
                            >
                              {t("delete")}
                            </Button>
                          </Table.Cell>
                        );
                      default:
                        return <Table.Cell>{String(row[column.id as keyof MySlot] ?? "")}</Table.Cell>;
                    }
                  }}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Paginator page={page} totalPages={totalPages} loading={loading} onChange={handlePageChange} />

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{isEdit ? t("editSlotTitle") : t("addSlot")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-col gap-4">
                  <SelectField
                    label={t("weekday")}
                    value={formValue.weekday}
                    options={WEEKDAY_OPTIONS.map((wd) => ({
                      value: String(wd),
                      label: t(`weekday${wd}`),
                    }))}
                    onChange={(v) => setFormValue((s) => ({ ...s, weekday: v }))}
                    className="w-56"
                  />
                  <SelectField
                    label={t("slotRange")}
                    value={formValue.slotDefId}
                    options={slotDefs.map((def) => ({
                      value: String(def.slotDefId),
                      label: `${def.startClock}-${def.endClock}（${def.code}）`,
                    }))}
                    onChange={(v) => setFormValue((s) => ({ ...s, slotDefId: v }))}
                    placeholder={t("slotPlaceholder")}
                    className="w-72"
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setModalOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button variant="primary" isPending={submitting} onPress={handleSubmit}>
                  {t("submit")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* 批量上传结果：逐行失败原因 */}
      <Modal isOpen={!!uploadResult} onOpenChange={(open) => !open && setUploadResult(null)}>
        <Modal.Backdrop>
          <Modal.Container placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("uploadResult")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="text-sm mb-2">
                  {t("uploadSummary", { success: uploadResult?.success ?? 0, fail: uploadResult?.fail ?? 0 })}
                </div>
                <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
                  {(uploadResult?.errors || []).map((e, idx) => (
                    <div key={idx} className="text-xs text-red-500">
                      {t("uploadRowError", { row: e.row, reason: e.reason })}
                    </div>
                  ))}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setUploadResult(null)}>
                  {t("close")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* 取消时段：已预约学生逐条取消并邮件告知（抄送顾问本人），原因选填 */}
      <AlertDialog
        isOpen={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeCancelDialog();
          }
        }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>{t("confirmCancelSlot")}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <div className="mb-2">
                  {t("cancelSlotRange", {
                    weekday: cancelTarget?.weekdayLabel ?? "",
                    date: (cancelTarget?.startTime ?? "").split(" ")[0],
                    start: cancelTarget?.startClock ?? "",
                    end: cancelTarget?.endClock ?? "",
                  })}{" "}
                  {Number(cancelTarget?.booked) > 0
                    ? t("cancelSlotNotify", { count: Number(cancelTarget?.booked) })
                    : t("cancelSlotNoBooking")}
                </div>
                <textarea
                  className="w-full h-20 rounded-lg border border-gray-300 p-2 text-sm"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t("cancelSlotReasonPlaceholder")}
                />
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" onPress={closeCancelDialog}>
                  {t("back")}
                </Button>
                <Button variant="danger" isPending={cancelling} onPress={handleCancelSlot}>
                  {t("cancelSlot")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <AlertDialog isOpen={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>{t("confirmDelete")}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                {t("deleteSlotRange", {
                  weekday: deleteTarget?.weekdayLabel ?? "",
                  start: deleteTarget?.startClock ?? "",
                  end: deleteTarget?.endClock ?? "",
                })}{" "}
                {t("deleteConstraint")}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" onPress={() => setDeleteTarget(null)}>
                  {t("cancel")}
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    setDeleteTarget(null);
                    handleDelete();
                  }}
                >
                  {t("delete")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}
