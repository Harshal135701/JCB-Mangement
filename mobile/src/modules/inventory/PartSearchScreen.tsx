import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { AppHeader } from '../../components/AppHeader';

export const PartSearchScreen = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const workOrderId = route.params?.workOrderId;

  const [search, setSearch] = useState('');
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchParts = async (query = '') => {
    try {
      setLoading(true);
      const res: any = await apiClient.get(`/inventory/search?query=${encodeURIComponent(query)}&limit=25`);
      if (res.success && res.data) {
        setParts(res.data);
      }
    } catch (e: any) {
      console.warn('Part search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts('');
  }, []);

  const handleReserve = async (part: any) => {
    if (!workOrderId) {
      Alert.alert(
        'Part Location',
        `Part: ${part.part_number}\nName: ${part.name}\nRack: ${part.rack_number || 'A-1'}, Bin: ${part.bin_number || part.bin_location || '01'}`
      );
      return;
    }

    try {
      setLoading(true);
      const res: any = await apiClient.post('/inventory/reserve', {
        work_order_id: workOrderId,
        part_id: part.id,
        quantity: 1,
      });

      if (res.success) {
        Alert.alert('Reserved', `1 unit of ${part.part_number} reserved for active Work Order.`);
        fetchParts(search);
      }
    } catch (e: any) {
      Alert.alert('Stock Reservation Failed', e.message || 'Cannot reserve part.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Find Spare Parts"
        icon="magnify"
        sectionTitle="Spare Parts Search"
        sectionSubtitle={workOrderId ? 'Reserve parts for Work Order' : 'Search workshop catalog & bin racks'}
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search part number, description or OEM..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              fetchParts(text);
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); fetchParts(''); }}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />}

      <FlatList
        data={parts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="package-variant" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No matching parts found</Text>
              <Text style={styles.emptySub}>Try searching by part number or name</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const inStock = item.available_stock > 0;
          return (
            <View style={styles.partCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.partNumber}>{item.part_number}</Text>
                  <Text style={styles.partName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>

                <View style={[styles.stockPill, inStock ? styles.stockPillIn : styles.stockPillOut]}>
                  <Text style={[styles.stockPillText, inStock ? styles.stockTextIn : styles.stockTextOut]}>
                    {inStock ? `${item.available_stock} Available` : 'Out of Stock'}
                  </Text>
                </View>
              </View>

              {item.description ? (
                <Text style={styles.partDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* Location Row */}
              <View style={styles.locationRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748B" />
                <Text style={styles.locationText}>
                  Location: Rack {item.rack_number || 'A-1'} • Bin {item.bin_number || item.bin_location || '01'}
                </Text>
              </View>

              {workOrderId && (
                <TouchableOpacity
                  style={[styles.reserveBtn, !inStock && styles.reserveBtnDisabled]}
                  onPress={() => handleReserve(item)}
                  disabled={!inStock}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={inStock ? 'cart-plus' : 'alert-circle-outline'}
                    size={16}
                    color={inStock ? '#000000' : '#64748B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.reserveBtnText, !inStock && styles.reserveBtnTextDisabled]}>
                    {inStock ? 'Reserve for Work Order' : 'Out of Stock - Request PR'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  brandBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  brandBadgeText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  searchSection: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },
  list: {
    padding: 14,
    gap: 12,
    paddingBottom: 36,
  },
  partCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  partNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  partName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  stockPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockPillIn: {
    backgroundColor: '#ECFDF5',
  },
  stockPillOut: {
    backgroundColor: '#FEF2F2',
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stockTextIn: {
    color: '#047857',
  },
  stockTextOut: {
    color: '#B91C1C',
  },
  partDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
    gap: 6,
  },
  locationText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  reserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  reserveBtnDisabled: {
    backgroundColor: '#F1F5F9',
  },
  reserveBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  reserveBtnTextDisabled: {
    color: '#94A3B8',
  },
  emptyBox: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
});
