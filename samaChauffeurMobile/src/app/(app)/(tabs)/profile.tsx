import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { deleteAccount, getChauffeurRatingSummary, getClientProfile, saveDiscountCode, updateMe } from '@/lib/api';
import { colors, fonts, fontSizes, spacing } from '@/constants/theme';
import { VEHICLE_TYPES } from '@/constants/config';
import type { ChauffeurRatingSummary } from '@/types';

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'wo', label: 'Wolof' },
] as const;

export default function ProfileTab() {
  const { user, chauffeur, mode, setMode, canDriverMode, logout, refreshMe } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ code: string; pct: number } | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [savingPromo, setSavingPromo] = useState(false);

  const [rating, setRating] = useState<ChauffeurRatingSummary | null>(null);
  const vehicle = chauffeur?.vehicle ?? null;

  useEffect(() => {
    if (user?.role !== 'CLIENT') return;
    getClientProfile()
      .then((res) => {
        setReferralCode(res.data.referral_code || null);
        setPendingPromo(res.data.pending_promo_code ? { code: res.data.pending_promo_code, pct: res.data.pending_promo_discount_pct ?? 0 } : null);
      })
      .catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'CHAUFFEUR' || !chauffeur?.id) return;
    getChauffeurRatingSummary(chauffeur.id)
      .then((r) => setRating(r.data))
      .catch(() => {});
  }, [user?.role, chauffeur?.id]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const startEditUsername = () => {
    setUsernameDraft(user?.username ?? '');
    setEditingUsername(true);
  };

  const saveUsername = async () => {
    const next = usernameDraft.trim();
    if (!next || next === user?.username) {
      setEditingUsername(false);
      return;
    }
    setSavingUsername(true);
    try {
      await updateMe({ username: next });
      await refreshMe();
      setEditingUsername(false);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSavingUsername(false);
    }
  };

  const changeLanguage = async (language: string) => {
    if (language === (user?.language || 'fr')) return;
    setSavingLanguage(true);
    try {
      await updateMe({ language });
      await refreshMe();
    } catch {
      // non-critical
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleSavePromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setSavingPromo(true);
    setPromoError(null);
    try {
      const r = await saveDiscountCode(code);
      if (r.data.valid) {
        setPendingPromo({ code: code.toUpperCase(), pct: r.data.discount_pct });
        setPromoInput('');
      } else {
        setPromoError(r.data.detail || 'Code invalide');
      }
    } catch (err: any) {
      setPromoError(err?.response?.data?.detail || 'Erreur lors de la vérification du code');
    } finally {
      setSavingPromo(false);
    }
  };

  const shareReferralCode = () => {
    if (!referralCode) return;
    Share.share({ message: `Utilisez mon code ${referralCode} sur samaChauffeur pour profiter de 10% de réduction sur votre première course.` });
  };

  const handleDelete = () => {
    Alert.alert('Supprimer définitivement le compte ?', 'Vos courses et votre historique seront supprimés. Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteAccount();
            await logout();
            router.replace('/(auth)/login');
          } catch (err: any) {
            Alert.alert('Erreur', err?.response?.data?.detail || 'Erreur lors de la suppression du compte');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const vehicleLabel = vehicle ? VEHICLE_TYPES.find((v) => v.value === vehicle.type)?.label || vehicle.type : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatarWrap}>
        <Avatar name={user?.username} size="xl" tone="brand" />
        {!editingUsername ? (
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user?.username}</Text>
            <Ionicons name="pencil" size={13} color={colors.muted} onPress={startEditUsername} />
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            <Input value={usernameDraft} onChangeText={setUsernameDraft} autoFocus />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.sm }}>
              <Button variant="outline" size="sm" style={{ flex: 1 }} onPress={() => setEditingUsername(false)} disabled={savingUsername}>
                Annuler
              </Button>
              <Button size="sm" style={{ flex: 1 }} onPress={saveUsername} loading={savingUsername}>
                Enregistrer
              </Button>
            </View>
          </View>
        )}
        <Text style={styles.phone}>{user?.phone}</Text>
        {mode && (
          <View style={styles.modePill}>
            <Ionicons name={mode === 'driver' ? 'car-sport' : 'person'} size={12} color={colors.brand[700]} />
            <Text style={styles.modePillText}>{mode === 'driver' ? 'Mode chauffeur' : 'Mode passager'}</Text>
          </View>
        )}
      </View>

      {canDriverMode && (
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Mode chauffeur</Text>
            <Text style={styles.rowSubtitle}>Basculez entre passager et chauffeur</Text>
          </View>
          <Switch
            value={mode === 'driver'}
            onValueChange={(v) => setMode(v ? 'driver' : 'passenger')}
            trackColor={{ false: colors.border, true: colors.secondary[400] }}
            thumbColor={colors.white}
          />
        </Card>
      )}

      {user?.role === 'CLIENT' && (
        <Card style={styles.linkRow} onPress={() => router.push('/(app)/become-driver')}>
          <Ionicons name="car-outline" size={20} color={colors.brand[600]} />
          <Text style={styles.linkText}>Devenir chauffeur</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 'auto' }} />
        </Card>
      )}

      {user?.role === 'CHAUFFEUR' && !chauffeur?.is_verified && (
        <Card style={{ backgroundColor: colors.accent[300] + '33', marginBottom: spacing.md }}>
          <Text style={styles.pendingText}>
            <Ionicons name="hourglass-outline" size={14} /> Votre profil chauffeur est en attente de vérification par un administrateur.
          </Text>
        </Card>
      )}

      {user?.role === 'CHAUFFEUR' && (vehicle || rating) && (
        <Card style={{ gap: spacing.xs }}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Mon véhicule</Text>
            {rating && rating.count > 0 && (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={12} color={colors.accent[700]} />
                <Text style={styles.ratingPillText}>
                  {rating.average} ({rating.count})
                </Text>
              </View>
            )}
          </View>
          {vehicle ? (
            <Text style={styles.rowSubtitle}>
              {vehicleLabel} · {vehicle.seats} places · {vehicle.plate_number}
            </Text>
          ) : (
            <Text style={styles.rowSubtitle}>Aucun véhicule renseigné</Text>
          )}
        </Card>
      )}

      {user?.role === 'CLIENT' && (
        <Card>
          <Text style={styles.rowTitle}>
            <Ionicons name="pricetag-outline" size={15} color={colors.brand[600]} /> Code promo
          </Text>
          <Text style={styles.rowSubtitle}>Il s&apos;applique automatiquement à votre prochaine course.</Text>
          {pendingPromo && (
            <View style={styles.promoActiveBox}>
              <Text style={styles.promoActiveText}>
                Code actif : {pendingPromo.code} (-{pendingPromo.pct}%)
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input placeholder="Ex: SAMA10" autoCapitalize="characters" value={promoInput} onChangeText={(v) => { setPromoInput(v.toUpperCase()); setPromoError(null); }} error={promoError} />
            </View>
            <Button variant="outline" size="md" onPress={handleSavePromo} loading={savingPromo} disabled={!promoInput.trim()}>
              {pendingPromo ? 'Remplacer' : 'Valider'}
            </Button>
          </View>
        </Card>
      )}

      {user?.role === 'CLIENT' && referralCode && (
        <Card style={styles.linkRow} onPress={shareReferralCode}>
          <Ionicons name="gift-outline" size={20} color={colors.brand[600]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Parrainage</Text>
            <Text style={styles.rowSubtitle}>Code : {referralCode}</Text>
          </View>
          <Ionicons name="share-social-outline" size={18} color={colors.muted} />
        </Card>
      )}

      <Card style={styles.linkRow} onPress={() => router.push('/(app)/payment-methods')}>
        <Ionicons name="card-outline" size={20} color={colors.brand[600]} />
        <Text style={styles.linkText}>Moyens de paiement</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 'auto' }} />
      </Card>

      <Card>
        <Text style={styles.rowTitle}>Langue</Text>
        <View style={styles.languageRow}>
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = (user?.language || 'fr') === opt.value;
            return (
              <Button key={opt.value} size="sm" variant={active ? 'secondary' : 'outline'} onPress={() => changeLanguage(opt.value)} disabled={savingLanguage}>
                {opt.label}
              </Button>
            );
          })}
        </View>
      </Card>

      <Button
        variant="outline"
        fullWidth
        size="lg"
        loading={loggingOut}
        onPress={() => Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Déconnexion', style: 'destructive', onPress: handleLogout },
        ])}
        style={{ marginTop: spacing.md }}
      >
        Se déconnecter
      </Button>

      <Card variant="outlined" style={{ borderColor: colors.dangerBg, marginTop: spacing.md }}>
        <Text style={[styles.rowTitle, { color: colors.danger }]}>Zone de danger</Text>
        <Text style={styles.rowSubtitle}>La suppression de votre compte est définitive et irréversible.</Text>
        <Button variant="danger" fullWidth style={{ marginTop: spacing.md }} onPress={handleDelete} loading={deleting} icon={<Ionicons name="trash-outline" size={16} color={colors.white} />}>
          Supprimer mon compte
        </Button>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.huge, gap: spacing.md },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.lg, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontFamily: fonts.semiBold, fontSize: fontSizes.lg, color: colors.text, marginTop: spacing.sm },
  phone: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand[50],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  modePillText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.brand[700] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  rowSubtitle: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.muted, marginTop: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  pendingText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.brand[800], lineHeight: 18 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent[300] + '33', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  ratingPillText: { fontFamily: fonts.semiBold, fontSize: fontSizes.xs, color: colors.accent[700] },
  promoActiveBox: { backgroundColor: colors.secondary[50], borderRadius: 12, padding: spacing.sm, marginTop: spacing.sm },
  promoActiveText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.secondary[700] },
  languageRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
