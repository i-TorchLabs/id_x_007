"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertDialog, Button, Modal, Table, toast } from "@heroui/react";
import {
  advisorAcceptingSetApi,
  advisorMySlotListApi,
  advisorSlotBatchUploadApi,
  advisorSlotCreateApi,
  advisorSlotDeleteApi,
  advisorSlotStateApi,
  advisorSlotTemplateApi,
  advisorSlotUpdateApi,
  type MySlot,
  type SlotBatchUploadRes,
  type SlotFormValue,
} from "@/api/advisor";
import Paginator from "@/components/pa/Paginator";
import { SlotStateChip } from "@/components/pa/StateChip";
import FormField from "@/components/pa/FormField";
import SwitchField from "@/components/pa/SwitchField";
import { downloadBase64 } from "@/utils/download";
import { isTrue, msToLocal } from "@/utils/format";

const PAGE_SIZE = 20;

const emptyForm: SlotFormValue = {
  start_time: "",
  end_time: "",
};

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
  const [uploadResult, setUploadResult] = useState<SlotBatchUploadRes | null>(null);
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

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const openModal = (row?: MySlot) => {
    if (row) {
      setIsEdit(true);
      setEditId(row.slotId);
      // 编辑回填用数值毫秒字段（展示字段为格式化字符串，不可逆转）
      setFormValue({
        start_time: msToLocal(row.startTimeMs),
        end_time: msToLocal(row.endTimeMs),
      });
    } else {
      setIsEdit(false);
      setEditId("");
      setFormValue(emptyForm);
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formValue.start_time || !formValue.end_time) {
      toast.danger(t("timeRequired"));
      return;
    }
    if (formValue.end_time <= formValue.start_time) {
      toast.danger(t("endAfterStart"));
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
    { id: "startTime", name: t("startTime") },
    { id: "endTime", name: t("endTime") },
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
                      case "startTime":
                        return <Table.Cell>{row.startTime}</Table.Cell>;
                      case "endTime":
                        return <Table.Cell>{row.endTime}</Table.Cell>;
                      case "booked":
                        return (
                          <Table.Cell>
                            {Number(row.booked) > 0 ? t("slotBooked") : t("slotAvailable")}
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
                  <FormField
                    label={t("startTime")}
                    type="datetime-local"
                    value={formValue.start_time}
                    onChange={(v) => setFormValue((s) => ({ ...s, start_time: v }))}
                  />
                  <FormField
                    label={t("endTime")}
                    type="datetime-local"
                    value={formValue.end_time}
                    onChange={(v) => setFormValue((s) => ({ ...s, end_time: v }))}
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
                  start: deleteTarget?.startTime ?? "",
                  end: deleteTarget?.endTime ?? "",
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
