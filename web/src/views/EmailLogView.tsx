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
import Paginator from "@/components/pa/Paginator";
import SelectField from "@/components/pa/SelectField";
import FormField from "@/components/pa/FormField";

const PAGE_SIZE = 20;
const ALL = "__all__";

/** 模板可用占位符（后端渲染时替换） */
const PLACEHOLDERS =
  "{intro} {apply_no} {advisor_name} {student_name} {student_no} {start_time} {end_time} {topic} {mode} {extra}";

const MailTypeChip = ({ mailType }: { mailType: string }) => {
  const t = useTranslations("emailLog");
  if (mailType === "cancelled") return <Chip color="danger">{t("type.cancelled")}</Chip>;
  if (mailType === "reminder") return <Chip color="warning">{t("type.reminder")}</Chip>;
  return <Chip color="accent">{t("type.booked")}</Chip>;
};

const MailStatusChip = ({ status }: { status: string }) => {
  const t = useTranslations("emailLog");
  if (status === "sent") return <Chip color="success">{t("status.sent")}</Chip>;
  if (status === "failed") return <Chip color="danger">{t("status.failed")}</Chip>;
  return <Chip>{t("status.skipped")}</Chip>;
};

/** 邮件模板编辑 Modal：下拉切换三类模板，编辑 subject + html */
function MailTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("emailLog");
  const [templates, setTemplates] = useState<Record<string, MailTemplate>>({});
  const [current, setCurrent] = useState("booked");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /** 三类模板的展示名 */
  const templateTypeOptions = [
    { value: "booked", label: t("templateType.booked") },
    { value: "cancelled", label: t("templateType.cancelled") },
    { value: "reminder", label: t("templateType.reminder") },
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
        applyTemplate("booked", map);
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
                  onChange={(v) => applyTemplate(v || "booked", templates)}
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
  const [loading, setLoading] = useState(false);
  const [mailType, setMailType] = useState(ALL);
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<ManageEmailLog[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);

  const mailTypeOptions = [
    { value: ALL, label: t("filter.allTypes") },
    { value: "booked", label: t("type.booked") },
    { value: "cancelled", label: t("type.cancelled") },
    { value: "reminder", label: t("type.reminder") },
  ];

  const getData = useCallback(
    async (pageNo = page, mt = mailType) => {
      setLoading(true);
      try {
        const res = await manageEmailLogListApi({
          page: pageNo,
          pageSize: PAGE_SIZE,
          mailType: mt === ALL ? "" : mt,
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
    const next = v || ALL;
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
        <SelectField
          label={t("filter.mailType")}
          value={mailType}
          options={mailTypeOptions}
          onChange={handleTypeChange}
        />
        <Button variant="primary" onPress={() => setTemplateOpen(true)}>
          {t("mailTemplates")}
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
