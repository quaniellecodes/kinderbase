import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#111' },
  header: { marginBottom: 24 },
  centerName: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subtitle: { fontSize: 9, color: '#666' },
  section: { marginBottom: 20 },
  staffName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 3 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 5, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tableRowLast: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8 },
  colDate: { width: '22%' },
  colIn: { width: '24%' },
  colOut: { width: '24%' },
  colDuration: { width: '18%', textAlign: 'right' },
  colNotes: { width: '12%' },
  headerText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase' },
  totalRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  totalLabel: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  totalValue: { fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'right', width: '18%' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
  summaryTable: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 3, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  summaryRowLast: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8 },
});

type Entry = {
  id: string;
  user_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  notes: string | null;
  users?: { full_name: string } | null;
};

type Props = {
  centerName: string;
  dateFrom: string;
  dateTo: string;
  entries: Entry[];
  generatedAt: string;
};

function fmt(iso: string, type: 'date' | 'time') {
  const d = new Date(iso);
  if (type === 'date') return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function duration(inAt: string, outAt: string | null): string {
  if (!outAt) return '(active)';
  const mins = Math.floor((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function durationMins(inAt: string, outAt: string | null): number {
  if (!outAt) return 0;
  return Math.floor((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000);
}

function minsToHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function AttendanceReportDocument({ centerName, dateFrom, dateTo, entries, generatedAt }: Props) {
  // Group by staff member
  const byStaff = new Map<string, { name: string; entries: Entry[] }>();
  for (const e of entries) {
    const name = e.users?.full_name ?? 'Unknown';
    if (!byStaff.has(e.user_id)) byStaff.set(e.user_id, { name, entries: [] });
    byStaff.get(e.user_id)!.entries.push(e);
  }

  const staffList = Array.from(byStaff.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.centerName}>{centerName}</Text>
          <Text style={styles.subtitle}>
            Staff Attendance Report  •  {dateFrom} – {dateTo}
          </Text>
        </View>

        {/* Summary table */}
        <View style={styles.summaryTable}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, { flex: 1 }]}>Staff Member</Text>
            <Text style={[styles.headerText, { width: '15%', textAlign: 'right' }]}>Total Hours</Text>
          </View>
          {staffList.map((s, i) => {
            const totalMins = s.entries.reduce((acc, e) => acc + durationMins(e.clocked_in_at, e.clocked_out_at), 0);
            const isLast = i === staffList.length - 1;
            return (
              <View key={s.name} style={isLast ? styles.summaryRowLast : styles.summaryRow}>
                <Text style={{ flex: 1 }}>{s.name}</Text>
                <Text style={{ width: '15%', textAlign: 'right' }}>{minsToHours(totalMins)}</Text>
              </View>
            );
          })}
        </View>

        {/* Per-staff detail */}
        {staffList.map(s => {
          const totalMins = s.entries.reduce((acc, e) => acc + durationMins(e.clocked_in_at, e.clocked_out_at), 0);
          return (
            <View key={s.name} style={styles.section}>
              <Text style={styles.staffName}>{s.name}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerText, styles.colDate]}>Date</Text>
                  <Text style={[styles.headerText, styles.colIn]}>Clock In</Text>
                  <Text style={[styles.headerText, styles.colOut]}>Clock Out</Text>
                  <Text style={[styles.headerText, styles.colDuration]}>Duration</Text>
                </View>
                {s.entries.map((e, i) => {
                  const isLast = i === s.entries.length - 1;
                  return (
                    <View key={e.id} style={isLast ? styles.tableRowLast : styles.tableRow}>
                      <Text style={styles.colDate}>{fmt(e.clocked_in_at, 'date')}</Text>
                      <Text style={styles.colIn}>{fmt(e.clocked_in_at, 'time')}</Text>
                      <Text style={styles.colOut}>{e.clocked_out_at ? fmt(e.clocked_out_at, 'time') : '—'}</Text>
                      <Text style={styles.colDuration}>{duration(e.clocked_in_at, e.clocked_out_at)}</Text>
                    </View>
                  );
                })}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{minsToHours(totalMins)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt} • KinderBase</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
