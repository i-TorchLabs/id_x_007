"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Table, toast } from "@heroui/react";
import {
  manageAppointmentExportApi,
  manageStatsApi,
  type ManageStatsRes,
} from "@/api/admin";
import { downloadBase64 } from "@/utils/download";

/** D-5 统计概览：4 张统计卡 + 顾问咨询量排名 + 全量导出 */
export default function StatsView() {
  const t = useTranslations("stats");
  const [stats, setStats] = useState<ManageStatsRes | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    manageStatsApi()
      .then(setStats)
      .catch((error) => toast.danger((error as Error).message || t("loadFail")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const res = await manageAppointmentExportApi({ advisorId: "", month: "" });
      downloadBase64(res.fileName, res.fileBase64);
    } catch (error) {
      toast.danger((error as Error).message || t("exportFail"));
    }
    setExporting(false);
  };

  const cards = [
    { label: t("cards.total"), value: stats?.total, color: "text-[#5b2a86]" },
    { label: t("cards.completed"), value: stats?.completed, color: "text-green-600" },
    { label: t("cards.cancelled"), value: stats?.cancelled, color: "text-red-500" },
    { label: t("cards.booked"), value: stats?.booked, color: "text-amber-600" },
  ];

  const ranking = (stats?.ranking || []).map((r, idx) => ({ ...r, rank: String(idx + 1) }));

  const columns = [
    { id: "rank", name: t("columns.rank") },
    { id: "advisorName", name: t("columns.advisor") },
    { id: "count", name: t("columns.appointments") },
    { id: "completed", name: t("columns.completed") },
  ];

  return (
    <div>
      <div className="bg-white p-5 mb-2 flex items-center justify-between">
        <span className="font-bold text-gray-700">{t("overview")}</span>
        <Button variant="primary" isPending={exporting} onPress={handleExportAll}>
          {t("exportAll")}
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-2">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className={`text-3xl font-bold ${card.color}`}>{card.value ?? "-"}</div>
            <div className="mt-2 text-sm text-gray-500">{card.label}</div>
          </div>
        ))}
      </div>

      <Table aria-label={t("rankingTableAria")}>
        <Table.ScrollContainer>
          <Table.Content aria-label={t("dataTableAria")}>
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Column id={col.id} isRowHeader={col.id === columns[0].id}>
                  {col.name}
                </Table.Column>
              )}
            </Table.Header>
            <Table.Body
              items={ranking}
              renderEmptyState={() => <div className="p-4">{t("noData")}</div>}
            >
              {(row) => (
                <Table.Row id={row.rank} columns={columns}>
                  {(column: { id: string; name: string }) => (
                    <Table.Cell>{String(row[column.id as keyof typeof row] ?? "")}</Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
