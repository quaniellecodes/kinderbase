import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { CREDENTIAL_TYPE_LABELS, type CredentialStatus } from '@kinderbase/types';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#111' },
  header: { marginBottom: 24 },
  centerName: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subtitle: { fontSize: 9, color: '#666' },
  section: { marginBottom: 20 },
  staffName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  noCredentials: { fontSize: 9, color: '#9ca3af', fontStyle: 'italic', paddingLeft: 4, marginBottom: 8 },
  table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 3 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 5, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tableRowLast: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8 },
  colType: { width: '34%' },
  colOrg: { width: '26%' },
  colIssued: { width: '16%' },
  colExpiry: { width: '16%' },
  colStatus: { width: '8%', textAlign: 'right' },
  headerText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase' },
  badge: { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
  legendRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 7, color: '#6b7280' },
});

type Credential = {
  id: string;
  credential_type: string;
  custom_type_name: string | null;
  issuing_org: string;
  issued_at: string;
  expires_at: string | null;
  status: CredentialStatus;
};

type StaffEntry = {
  id: string;
  full_name: string;
  credentials: Credential[];
};

type Props = {
  centerName: string;
  staff: StaffEntry[];
  generatedAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(status: CredentialStatus) {
  switch (status) {
    case 'active': return '✓';
    case 'expiring_soon': return '!';
    case 'expired': return '✗';
    case 'no_expiration': return '∞';
  }
}

function statusColor(status: CredentialStatus) {
  switch (status) {
    case 'active': return '#16a34a';
    case 'expiring_soon': return '#d97706';
    case 'expired': return '#dc2626';
    case 'no_expiration': return '#6b7280';
  }
}

function credLabel(c: Credential) {
  if (c.credential_type === 'other' && c.custom_type_name) return c.custom_type_name;
  return CREDENTIAL_TYPE_LABELS[c.credential_type as keyof typeof CREDENTIAL_TYPE_LABELS] ?? c.credential_type;
}

export function CredentialsReportDocument({ centerName, staff, generatedAt }: Props) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.centerName}>{centerName}</Text>
          <Text style={styles.subtitle}>Staff Credentials Report  •  {generatedAt}</Text>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          {(['active', 'expiring_soon', 'expired', 'no_expiration'] as CredentialStatus[]).map(s => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: statusColor(s) }]} />
              <Text style={styles.legendText}>
                {s === 'active' ? 'Active' : s === 'expiring_soon' ? 'Expiring soon' : s === 'expired' ? 'Expired' : 'No expiration'}
              </Text>
            </View>
          ))}
        </View>

        {/* Per-staff credentials */}
        {staff.map(s => (
          <View key={s.id} style={styles.section} wrap={false}>
            <Text style={styles.staffName}>{s.full_name}</Text>
            {s.credentials.length === 0 ? (
              <Text style={styles.noCredentials}>No credentials on file</Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerText, styles.colType]}>Credential</Text>
                  <Text style={[styles.headerText, styles.colOrg]}>Issuing Org</Text>
                  <Text style={[styles.headerText, styles.colIssued]}>Issued</Text>
                  <Text style={[styles.headerText, styles.colExpiry]}>Expires</Text>
                  <Text style={[styles.headerText, styles.colStatus]}>Status</Text>
                </View>
                {s.credentials.map((c, i) => {
                  const isLast = i === s.credentials.length - 1;
                  return (
                    <View key={c.id} style={isLast ? styles.tableRowLast : styles.tableRow}>
                      <Text style={styles.colType}>{credLabel(c)}</Text>
                      <Text style={styles.colOrg}>{c.issuing_org}</Text>
                      <Text style={styles.colIssued}>{fmtDate(c.issued_at)}</Text>
                      <Text style={styles.colExpiry}>{c.expires_at ? fmtDate(c.expires_at) : '—'}</Text>
                      <Text style={[styles.colStatus, { color: statusColor(c.status), fontFamily: 'Helvetica-Bold' }]}>
                        {statusLabel(c.status)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt} • KinderBase</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
