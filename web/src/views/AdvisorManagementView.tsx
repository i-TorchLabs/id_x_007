"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertDialog, Button, Chip, Form, Input, Label, Modal, Table, TextField, toast } from "@heroui/react";
import {
  manageAdvisorCreateApi,
  manageAdvisorDeleteApi,
  manageAdvisorListApi,
  manageAdvisorUpdateApi,
  type ManageAdvisor,
  type ManageAdvisorFormValue,
} from "@/api/admin";
import Paginator from "@/components/pa/Paginator";
import SwitchField from "@/components/pa/SwitchField";
import { isTrue } from "@/utils/format";

const PAGE_SIZE = 20;
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

interface AdvisorForm extends ManageAdvisorFormValue {
  username: string;
  status: boolean;
  accepting: boolean;
}

const emptyForm: AdvisorForm = {
  username: "",
  name: "",
  email: "",
  grade: "",
  major: "",
  direction: "",
  bio: "",
  photo: "",
  status: true,
  accepting: true,
};

export default function AdvisorManagementView() {
  const t = useTranslations("advisorManagement");
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<ManageAdvisor[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState("");
  const [formValue, setFormValue] = useState<AdvisorForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManageAdvisor | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const getData = useCallback(
    async (pageNo = page) => {
      setLoading(true);
      try {
        const res = await manageAdvisorListApi({ page: pageNo, pageSize: PAGE_SIZE, keyword });
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

  const openModal = (row?: ManageAdvisor) => {
    if (row) {
      setIsEdit(true);
      setEditId(row.advisorId);
      setFormValue({
        username: row.username,
        name: row.name || "",
        email: row.email || "",
        grade: row.grade || "",
        major: row.major || "",
        direction: row.direction || "",
        bio: row.bio || "",
        photo: row.photo || "",
        status: isTrue(row.status),
        accepting: isTrue(row.accepting),
      });
    } else {
      setIsEdit(false);
      setEditId("");
      setFormValue(emptyForm);
    }
    setModalOpen(true);
  };

  /** 照片读取为 base64 data URL；限 3MB */
  const handlePhotoChange = (file: File) => {
    if (file.size > PHOTO_MAX_BYTES) {
      toast.danger(t("photoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormValue((s) => ({ ...s, photo: String(reader.result || "") }));
    };
    reader.onerror = () => toast.danger(t("photoReadFail"));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!isEdit && !formValue.username.trim()) {
      toast.danger(t("usernameRequired"));
      return;
    }
    if (!formValue.name.trim()) {
      toast.danger(t("nameRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const base = {
        name: formValue.name.trim(),
        email: formValue.email.trim(),
        grade: formValue.grade.trim(),
        major: formValue.major.trim(),
        direction: formValue.direction.trim(),
        bio: formValue.bio,
        photo: formValue.photo,
      };
      if (isEdit) {
        await manageAdvisorUpdateApi({
          ...base,
          advisorId: editId,
          status: formValue.status,
          accepting: formValue.accepting,
        });
      } else {
        await manageAdvisorCreateApi({ ...base, username: formValue.username.trim() });
      }
      toast.success(t("saved"));
      setModalOpen(false);
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("saveFail"));
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await manageAdvisorDeleteApi(deleteTarget.advisorId);
      toast.success(t("deleted"));
      getData();
    } catch (error) {
      // 有预约等关联数据时后端拒绝删除，透出后端 msg
      toast.danger((error as Error).message || t("deleteFail"));
    }
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));

  const columns = [
    { id: "username", name: t("columns.username") },
    { id: "name", name: t("columns.name") },
    { id: "email", name: t("columns.email") },
    { id: "grade", name: t("columns.grade") },
    { id: "major", name: t("columns.major") },
    { id: "direction", name: t("columns.direction") },
    { id: "status", name: t("columns.status") },
    { id: "accepting", name: t("columns.accepting") },
    { id: "slotCount", name: t("columns.slots") },
    { id: "appointmentCount", name: t("columns.appointments") },
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

      <Table aria-label={t("advisorListAria")}>
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
                <Table.Row id={row.advisorId} columns={columns}>
                  {(column: { id: string; name: string }) => {
                    switch (column.id) {
                      case "status":
                        return (
                          <Table.Cell>
                            {isTrue(row.status) ? (
                              <Chip color="success">{t("enabled")}</Chip>
                            ) : (
                              <Chip color="danger">{t("disabled")}</Chip>
                            )}
                          </Table.Cell>
                        );
                      case "accepting":
                        return (
                          <Table.Cell>
                            {isTrue(row.accepting) ? (
                              <Chip color="success">{t("yes")}</Chip>
                            ) : (
                              <Chip color="warning">{t("no")}</Chip>
                            )}
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
                            {String(row[column.id as keyof ManageAdvisor] ?? "")}
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
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {/* username 仅新建可填（登录账号，创建后不可改） */}
                  {!isEdit && (
                    <FieldRow label={t("fields.username")}>
                      <TextField
                        value={formValue.username}
                        onChange={(v) => setFormValue((s) => ({ ...s, username: v }))}
                        aria-label={t("fields.username")}
                        className="w-full"
                      >
                        <Input />
                      </TextField>
                    </FieldRow>
                  )}
                  <FieldRow label={t("fields.name")}>
                    <TextField
                      value={formValue.name}
                      onChange={(v) => setFormValue((s) => ({ ...s, name: v }))}
                      aria-label={t("fields.name")}
                      className="w-full"
                    >
                      <Input />
                    </TextField>
                  </FieldRow>
                  <FieldRow label={t("fields.email")}>
                    <TextField
                      value={formValue.email}
                      onChange={(v) => setFormValue((s) => ({ ...s, email: v }))}
                      aria-label={t("fields.email")}
                      className="w-full"
                    >
                      <Input />
                    </TextField>
                  </FieldRow>
                  <FieldRow label={t("fields.grade")}>
                    <TextField
                      value={formValue.grade}
                      onChange={(v) => setFormValue((s) => ({ ...s, grade: v }))}
                      aria-label={t("fields.grade")}
                      className="w-full"
                    >
                      <Input />
                    </TextField>
                  </FieldRow>
                  <FieldRow label={t("fields.major")}>
                    <TextField
                      value={formValue.major}
                      onChange={(v) => setFormValue((s) => ({ ...s, major: v }))}
                      aria-label={t("fields.major")}
                      className="w-full"
                    >
                      <Input />
                    </TextField>
                  </FieldRow>
                  <FieldRow label={t("fields.direction")}>
                    <TextField
                      value={formValue.direction}
                      onChange={(v) => setFormValue((s) => ({ ...s, direction: v }))}
                      aria-label={t("fields.direction")}
                      className="w-full"
                    >
                      <Input />
                    </TextField>
                  </FieldRow>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Label className="w-24 shrink-0 whitespace-nowrap text-left">{t("fields.bio")}</Label>
                  <textarea
                    className="min-w-0 flex-1 h-20 rounded-lg border border-gray-300 p-2 text-sm"
                    value={formValue.bio}
                    onChange={(e) => setFormValue((s) => ({ ...s, bio: e.target.value }))}
                    placeholder={t("bioPlaceholder")}
                  />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Label className="w-24 shrink-0 whitespace-nowrap text-left">{t("fields.photo")}</Label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoChange(file);
                      e.target.value = "";
                    }}
                  />
                  <Button size="sm" onPress={() => photoInputRef.current?.click()}>
                    {t("uploadPhoto")}
                  </Button>
                  {formValue.photo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formValue.photo}
                        alt={t("photoAlt")}
                        className="w-12 h-12 rounded-full object-cover border border-gray-200"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setFormValue((s) => ({ ...s, photo: "" }))}
                      >
                        {t("remove")}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">{t("noPhoto")}</span>
                  )}
                </div>
                {isEdit && (
                  <div className="mt-4 flex items-center gap-8">
                    <SwitchField
                      label={t("fields.enabled")}
                      checked={formValue.status}
                      onChange={(v) => setFormValue((s) => ({ ...s, status: v }))}
                    />
                    <SwitchField
                      label={t("fields.accepting")}
                      checked={formValue.accepting}
                      onChange={(v) => setFormValue((s) => ({ ...s, accepting: v }))}
                    />
                  </div>
                )}
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
                {t("deleteConfirmBody", { name: deleteTarget?.name ?? "" })}
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
