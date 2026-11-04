"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertDialog, Button, Table, toast } from "@heroui/react";
import {
  myAppointmentListApi,
  studentAppointmentCancelApi,
  type MyAppointment,
} from "@/api/user";
import Paginator from "@/components/pa/Paginator";
import { AppointmentStateChip } from "@/components/pa/StateChip";
import { isTrue } from "@/utils/format";

const PAGE_SIZE = 20;

export default function MyAppointmentsView() {
  const t = useTranslations("myAppointments");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [data, setData] = useState<MyAppointment[]>([]);
  const [cancelTarget, setCancelTarget] = useState<MyAppointment | null>(null);

  const getData = useCallback(
    async (pageNo = page) => {
      setLoading(true);
      try {
        const res = await myAppointmentListApi({ page: pageNo, pageSize: PAGE_SIZE });
        setData(res.list || []);
        setItemCount(Number(res.total) || 0);
      } catch (error) {
        toast.danger((error as Error).message || t("failToLoad"));
        setData([]);
      }
      setLoading(false);
    },
    [page, t]
  );

  useEffect(() => {
    getData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await studentAppointmentCancelApi(cancelTarget.appointmentId);
      toast.success(t("cancelled"));
      getData();
    } catch (error) {
      // 后端校验：距开始不足 4 小时等场景会拒绝
      toast.danger((error as Error).message || t("failToCancel"));
    }
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));

  const columns = [
    { id: "applyNo", name: t("colApplyNo") },
    { id: "advisorName", name: t("colAdvisor") },
    { id: "time", name: t("colTime") },
    { id: "topic", name: t("colTopic") },
    { id: "mode", name: t("colMode") },
    { id: "state", name: t("colState") },
    { id: "createTime", name: t("colCreateTime") },
    { id: "actions", name: t("colActions") },
  ];

  return (
    <div>
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
                <Table.Row id={row.appointmentId} columns={columns}>
                  {(column: { id: string; name: string }) => {
                    switch (column.id) {
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
                        return <Table.Cell className="capitalize">{row.mode}</Table.Cell>;
                      case "state":
                        return (
                          <Table.Cell>
                            <AppointmentStateChip state={row.state} />
                          </Table.Cell>
                        );
                      case "createTime":
                        return <Table.Cell>{row.createTime}</Table.Cell>;
                      case "actions":
                        return (
                          <Table.Cell>
                            {isTrue(row.cancelable) ? (
                              <Button
                                size="sm"
                                variant="danger"
                                onPress={() => setCancelTarget(row)}
                              >
                                {t("cancel")}
                              </Button>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </Table.Cell>
                        );
                      default:
                        return (
                          <Table.Cell>
                            {String(row[column.id as keyof MyAppointment] ?? "")}
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

      <AlertDialog
        isOpen={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>{t("confirmCancelTitle")}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                {t("confirmCancelBody", {
                  applyNo: cancelTarget?.applyNo ?? "",
                  advisorName: cancelTarget?.advisorName ?? "",
                })}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="ghost" onPress={() => setCancelTarget(null)}>
                  {t("back")}
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    setCancelTarget(null);
                    handleCancel();
                  }}
                >
                  {t("confirm")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}
