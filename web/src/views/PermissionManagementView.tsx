"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertDialog, Button, Checkbox, Form, Input, Label, Modal, Table, TextField, toast } from "@heroui/react";
import {
  manageAllowCreateApi,
  manageAllowDeleteApi,
  manageAllowListApi,
  manageAllowUpdateApi,
  type ManageAllow,
} from "@/api/admin";
import Paginator from "@/components/pa/Paginator";
import SwitchField from "@/components/pa/SwitchField";
import { isTrue } from "@/utils/format";

const PAGE_SIZE = 20;

interface AllowForm {
  email: string;
  allow: boolean;
}

const emptyForm: AllowForm = { email: "", allow: true };

/** 权限管理：顾问 SSO 登录白名单维护（仅 admin，入口见 AdminLayout / admin/layout.tsx AuthGuard） */
export default function PermissionManagementView() {
  const t = useTranslations("permissionManagement");
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<ManageAllow[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState("");
  const [formValue, setFormValue] = useState<AllowForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManageAllow | null>(null);
  // 行内勾选请求中的记录 ID（防重复点击）
  const [togglingId, setTogglingId] = useState("");

  const getData = useCallback(
    async (pageNo = page) => {
      setLoading(true);
      try {
        const res = await manageAllowListApi({ page: pageNo, pageSize: PAGE_SIZE, keyword });
        setData(res.list || []);
        setItemCount(Number(res.total) || 0);
      } catch (error) {
        toast.danger((error as Error).message || t("loadFail"));
        setData([]);
      }
      setLoading(false);
    },
    [page, keyword, t]
  );

  useEffect(() => {
    getData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchClick = () => {
    setPage(1);
    getData(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const openModal = (row?: ManageAllow) => {
    if (row) {
      setIsEdit(true);
      setEditId(row.allowId);
      setFormValue({ email: row.email, allow: isTrue(row.allow) });
    } else {
      setIsEdit(false);
      setEditId("");
      setFormValue(emptyForm);
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formValue.email.trim()) {
      toast.danger(t("emailRequired"));
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await manageAllowUpdateApi({
          allowId: editId,
          email: formValue.email.trim(),
          allow: formValue.allow,
        });
      } else {
        await manageAllowCreateApi({ email: formValue.email.trim(), allow: formValue.allow });
      }
      toast.success(t("saved"));
      setModalOpen(false);
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("saveFail"));
    }
    setSubmitting(false);
  };

  /** 行内勾选：打勾则允许登录，取消则拒绝（立即生效） */
  const handleToggleAllow = async (row: ManageAllow, checked: boolean) => {
    setTogglingId(row.allowId);
    try {
      await manageAllowUpdateApi({ allowId: row.allowId, allow: checked });
      // 局部更新，避免整表刷新丢失当前页滚动位置
      setData((list) =>
        list.map((item) =>
          item.allowId === row.allowId ? { ...item, allow: checked ? "1" : "0" } : item
        )
      );
      toast.success(t("saved"));
    } catch (error) {
      toast.danger((error as Error).message || t("saveFail"));
    }
    setTogglingId("");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await manageAllowDeleteApi(deleteTarget.allowId);
      toast.success(t("deleted"));
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("deleteFail"));
    }
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));

  const columns = [
    { id: "email", name: t("columns.email") },
    { id: "allow", name: t("columns.allow") },
    { id: "createTime", name: t("columns.createTime") },
    { id: "updateTime", name: t("columns.updateTime") },
    { id: "actions", name: t("columns.options") },
  ];

  return (
    <div>
      <div className="bg-white p-5 mb-2 flex items-center justify-between flex-wrap gap-2">
        <Form
          className="flex flex-row items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchClick();
          }}
        >
          <TextField value={keyword} onChange={setKeyword} aria-label={t("keyword")}>
            <div className="flex items-center gap-2">
              <Label className="shrink-0">{t("keyword")}</Label>
              <Input placeholder={t("keywordPlaceholder")} />
            </div>
          </TextField>
          <Button type="submit" onPress={handleSearchClick}>
            {t("search")}
          </Button>
        </Form>
        <Button variant="primary" onPress={() => openModal()}>
          {t("add")}
        </Button>
      </div>

      <div className="bg-white px-5 py-3 mb-2 text-sm text-gray-500">{t("hint")}</div>

      <Table aria-label={t("allowListAria")}>
        <Table.ScrollContainer>
          <Table.Content aria-label={t("dataTableAria")}>
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Column id={col.id} isRowHeader={col.id === columns[0].id}>
                  {col.name}
                </Table.Column>
              )}
            </Table.Header>
            <Table.Body items={data} renderEmptyState={() => <div className="p-4">{t("noData")}</div>}>
              {(row) => (
                <Table.Row id={row.allowId} columns={columns}>
                  {(column: { id: string; name: string }) => {
                    switch (column.id) {
                      case "allow":
                        return (
                          <Table.Cell>
                            <Checkbox
                              isSelected={isTrue(row.allow)}
                              isDisabled={togglingId === row.allowId}
                              onChange={(checked) => handleToggleAllow(row, checked)}
                              aria-label={t("allowCheckboxAria", { email: row.email })}
                            >
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox>
                          </Table.Cell>
                        );
                      case "actions":
                        return (
                          <Table.Cell>
                            <Button
                              size="sm"
                              variant="primary"
                              className="mr-2"
                              onPress={() => openModal(row)}
                            >
                              {t("edit")}
                            </Button>
                            <Button size="sm" variant="danger" onPress={() => setDeleteTarget(row)}>
                              {t("delete")}
                            </Button>
                          </Table.Cell>
                        );
                      default:
                        return (
                          <Table.Cell>
                            {String(row[column.id as keyof ManageAllow] ?? "")}
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

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop>
          <Modal.Container size="lg" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{isEdit ? t("editTitle") : t("addTitle")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <FieldRow label={t("fields.email")}>
                  <TextField
                    value={formValue.email}
                    onChange={(v) => setFormValue((s) => ({ ...s, email: v }))}
                    aria-label={t("fields.email")}
                    className="w-full"
                  >
                    <Input placeholder={t("emailPlaceholder")} />
                  </TextField>
                </FieldRow>
                <div className="mt-4 flex items-center gap-8">
                  <SwitchField
                    label={t("fields.allow")}
                    checked={formValue.allow}
                    onChange={(v) => setFormValue((s) => ({ ...s, allow: v }))}
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

      <AlertDialog isOpen={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>{t("deleteConfirmTitle")}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                {t("deleteConfirmBody", { email: deleteTarget?.email ?? "" })}
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

/** 弹窗内横向字段行：左侧固定宽度标签 + 右侧自适应控件 */
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-24 shrink-0 whitespace-nowrap text-left">{label}</Label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
