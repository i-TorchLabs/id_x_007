"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Chip, Modal, Table, toast } from "@heroui/react";
import {
  manageEmailLogListApi,
  manageMailTemplateListApi,
  manageMailTemplateUpdateApi,
  type MailTemplate,
  type ManageEmailLog,
} from "@/api/admin";
import { useUserStore } from "@/context/UserContext";
import Paginator from "@/components/pa/Paginator";
import SelectField from "@/components/pa/SelectField";
import FormField from "@/components/pa/FormField";

const PAGE_SIZE = 20;

/** 模板可用占位符（后端渲染时替换） */
const PLACEHOLDERS =
  "{intro} {apply_no} {advisor_name} {student_email} {student_no} {start_time} {end_time} {topic} {mode} {extra}";

const MailTypeChip = ({ mailType }: { mailType: string }) => {
  const t = useTranslations("emailLog");
  if (mailType === "cancelled") return <Chip color="danger">{t("type.cancelled")}</Chip>;
  if (mailType === "reminder") return <Chip color="warning">{t("type.reminder")}</Chip>;
  if (mailType === "booked_advisor") return <Chip color="success">{t("type.bookedAdvisor")}</Chip>;
  // booked_student（及旧版合并发送的 booked 历史日志）
  return <Chip color="accent">{t("type.bookedStudent")}</Chip>;
};

const MailStatusChip = ({ status }: { status: string }) => {
  const t = useTranslations("emailLog");
  if (status === "sent") return <Chip color="success">{t("status.sent")}</Chip>;
  if (status === "failed") return <Chip color="danger">{t("status.failed")}</Chip>;
  return <Chip>{t("status.skipped")}</Chip>;
};

/** 邮件模板编辑 Modal：下拉切换四类模板（各触发时点见选项文案），编辑 subject + html */
function MailTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("emailLog");
  const [templates, setTemplates] = useState<Record<string, MailTemplate>>({});
  const [current, setCurrent] = useState("booked_student");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /** 四类模板的展示名（与触发时点/收件人一一对应） */
  const templateTypeOptions = [
    { value: "booked_student", label: t("templateType.bookedStudent") },
    { value: "booked_advisor", label: t("templateType.bookedAdvisor") },
    { value: "reminder", label: t("templateType.reminder") },
    { value: "cancelled", label: t("templateType.cancelled") },
  ];

  // 切换模板类型时回填表单
  const applyTemplate = (type: string, map: Record<string, MailTemplate>) => {
    setCurrent(type);
    setSubject(map[type]?.subject ?? "");
    setHtml(map[type]?.html ?? "");
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    manageMailTemplateListApi()
      .then((res) => {
        const map: Record<string, MailTemplate> = {};
        (res.list || []).forEach((tpl) => {
          map[tpl.mailType] = tpl;
        });
        setTemplates(map);
        applyTemplate("booked_student", map);
      })
      .catch((error) => toast.danger((error as Error).message || t("toast.loadTemplatesFail")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.danger(t("toast.subjectRequired"));
      return;
    }
    if (!html.trim()) {
      toast.danger(t("toast.htmlRequired"));
      return;
    }
    setSaving(true);
    try {
      await manageMailTemplateUpdateApi({ mailType: current, subject, html });
      toast.success(t("toast.templateSaved"));
      // 本地同步，避免切换回来丢更新
      setTemplates((s) => ({
        ...s,
        [current]: { ...(s[current] || { mailType: current, updateTime: "" }), subject, html },
      }));
    } catch (error) {
      toast.danger((error as Error).message || t("toast.saveTemplateFail"));
    }
    setSaving(false);
  };

  return (
    <Modal isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t("mailTemplates")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-4">
                <SelectField
                  label={t("modal.template")}
                  value={current}
                  options={templateTypeOptions}
                  onChange={(v) => applyTemplate(v || "booked_student", templates)}
                  className="w-64"
                />
                <FormField label={t("modal.subject")} value={subject} onChange={setSubject} />
                <div>
                  <div className="text-sm text-gray-600 mb-1">{t("modal.htmlContent")}</div>
                  <textarea
                    className="w-full h-56 rounded-lg border border-gray-300 p-2 text-xs font-mono"
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="text-xs text-gray-400">
                  {t("modal.availablePlaceholders", { placeholders: PLACEHOLDERS })}
                </div>
                {templates[current]?.updateTime && (
                  <div className="text-xs text-gray-400">
                    {t("modal.lastUpdated", { time: templates[current].updateTime })}
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                {t("modal.close")}
              </Button>
              <Button variant="primary" isPending={saving} isDisabled={loading} onPress={handleSave}>
                {t("modal.save")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** D-6 邮件日志：按类型筛选查看发送结果；附邮件模板配置入口 */
export default function EmailLogView() {
  const t = useTranslations("emailLog");
  // 邮件模板为全局配置：入口仅 admin 可见（接口亦仅 admin 可调）
  const { state: userState } = useUserStore();
  const isAdminUser = userState.role === "admin";
  const [loading, setLoading] = useState(false);
  // 空串表示未筛选（全部类型）：下拉框仅呈现 4 种预约模板类型，占位文案承担「全部类型」
  const [mailType, setMailType] = useState("");
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<ManageEmailLog[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);

  /** 四类预约邮件（与后端 mail_type 一一对应） */
  const mailTypeOptions = [
    { value: "booked_student", label: t("type.bookedStudent") },
    { value: "booked_advisor", label: t("type.bookedAdvisor") },
    { value: "reminder", label: t("type.reminder") },
    { value: "cancelled", label: t("type.cancelled") },
  ];

  const getData = useCallback(
    async (pageNo = page, mt = mailType) => {
      setLoading(true);
      try {
        const res = await manageEmailLogListApi({
          page: pageNo,
          pageSize: PAGE_SIZE,
          mailType: mt,
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
    [page, mailType]
  );

  useEffect(() => {
    getData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTypeChange = (v: string) => {
    // 下拉仅含 4 类模板；清空选择即回到「全部类型」
    const next = v ?? "";
    setMailType(next);
    setPage(1);
    getData(1, next);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));

  const columns = [
    { id: "mailTo", name: t("column.recipient") },
    { id: "mailType", name: t("column.type") },
    { id: "subject", name: t("column.subject") },
    { id: "status", name: t("column.status") },
    { id: "error", name: t("column.error") },
    { id: "createTime", name: t("column.time") },
  ];

  return (
    <div>
      <div className="bg-white p-5 mb-2 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <SelectField
            label={t("filter.mailType")}
            value={mailType}
            options={mailTypeOptions}
            onChange={handleTypeChange}
            placeholder={t("filter.allTypes")}
          />
          {mailType && (
            <Button variant="ghost" size="sm" onPress={() => handleTypeChange("")}>
              {t("filter.reset")}
            </Button>
          )}
        </div>
        {isAdminUser && (
          <Button variant="primary" onPress={() => setTemplateOpen(true)}>
            {t("mailTemplates")}
          </Button>
        )}
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
            <Table.Body
              items={data.map((row, idx) => ({ ...row, _rowId: row.id || String(idx) }))}
              renderEmptyState={() => <div className="p-4">{t("noData")}</div>}
            >
              {(row) => (
                <Table.Row id={row._rowId} columns={columns}>
                  {(column: { id: string; name: string }) => {
                    switch (column.id) {
                      case "mailType":
                        return (
                          <Table.Cell>
                            <MailTypeChip mailType={row.mailType} />
                          </Table.Cell>
                        );
                      case "status":
                        return (
                          <Table.Cell>
                            <MailStatusChip status={row.status} />
                          </Table.Cell>
                        );
                      case "error":
                        return (
                          <Table.Cell>
                            <div className="max-w-[220px] truncate text-red-500" title={row.error}>
                              {row.error || "-"}
                            </div>
                          </Table.Cell>
                        );
                      default:
                        return (
                          <Table.Cell>
                            {String(row[column.id as keyof ManageEmailLog] ?? "")}
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

      <MailTemplateModal open={templateOpen} onClose={() => setTemplateOpen(false)} />
    </div>
  );
}
