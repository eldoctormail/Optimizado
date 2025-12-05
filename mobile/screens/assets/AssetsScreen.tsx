import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Image,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { useDispatch, useSelector } from '../../store';
import * as React from 'react';
import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { PermissionEntity } from '../../models/role';
import { getAssetChildren, getAssets, getMoreAssets } from '../../slices/asset';
import { FilterField, SearchCriteria } from '../../models/page';
import { Button, Card, Searchbar, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { AssetDTO, AssetRow } from '../../models/asset';
import { onSearchQueryChange } from '../../utils/overall';
import { RootStackScreenProps } from '../../types';
import Tag from '../../components/Tag';
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect';
import { IconWithLabel } from '../../components/IconWithLabel';
import { Asset } from 'expo-asset';
import { useAppTheme } from '../../custom-theme';

// [MODIFICADO] Optimización de Rendimiento: React.memo
// Impacto: Evita re-renderizados innecesarios de cada tarjeta al escribir en la búsqueda.
// Beneficio: Mejora drásticamente la fluidez y reduce el consumo de CPU/Batería.
const AssetCard = React.memo(({
  asset,
  navigation,
  showChildrenButton = false,
  onViewChildren
}: {
  asset: AssetDTO;
  navigation: RootStackScreenProps<'Assets'>['navigation'];
  showChildrenButton?: boolean;
  onViewChildren?: () => void;
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();

  return (
    <Card
      style={{
        padding: 5,
        marginVertical: 5,
        backgroundColor: 'white'
      }}
      key={asset.id}
      onPress={() =>
        navigation.push('AssetDetails', {
          id: asset.id,
          assetProp: asset
        })
      }
    >
      <Card.Content>
        <View style={{ ...styles.row, justifyContent: 'space-between' }}>
          <View style={{ ...styles.row, justifyContent: 'space-between' }}>
            <View style={{ marginRight: 10 }}>
              <Tag
                text={`#${asset.customId}`}
                color="white"
                backgroundColor="#545454"
              />
            </View>
            <Tag
              text={
                asset?.status === 'OPERATIONAL' ? t('operational') : t('down')
              }
              backgroundColor={
                asset.status === 'OPERATIONAL'
                  ? theme.colors.success
                  : theme.colors.error
              }
              color="white"
            />
          </View>
        </View>
        <View style={{ ...styles.row, marginTop: 5 }}>
          <Image
            style={{ height: 70, width: 70, borderRadius: 35, marginRight: 10 }}
            source={
              asset.image
                ? {
                  uri: asset.image.url
                }
                : Asset.fromModule(require('../../assets/images/no-image.png'))
            }
          />
          <Text variant="titleMedium">{asset.name}</Text>
        </View>
        {asset.location && (
          <IconWithLabel
            label={asset.location.name}
            icon="map-marker-outline"
          />
        )}
      </Card.Content>
      {showChildrenButton && asset.hasChildren && (
        <Card.Actions>
          <Button onPress={onViewChildren}>{t('view_children')}</Button>
        </Card.Actions>
      )}
    </Card>
  );
});

export default function AssetsScreen({
  navigation,
  route
}: RootStackScreenProps<'Assets'>) {
  const { t } = useTranslation();
  const [startedSearch, setStartedSearch] = useState<boolean>(false);
  const { assets, assetsHierarchy, loadingGet, currentPageNum, lastPage } =
    useSelector((state) => state.assets);
  const theme = useTheme();
  const [view, setView] = useState<'hierarchy' | 'list'>('hierarchy');
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const { hasViewPermission } = useAuth();
  const defaultFilterFields: FilterField[] = [];
  const getCriteriaFromFilterFields = (filterFields: FilterField[]) => {
    // [MODIFICADO] Ordenamiento Predeterminado
    // Impacto: Fuerza el orden por 'location.name' ascendente.
    // Beneficio: Los activos aparecen ordenados por ubicación (A-Z) por defecto.
    const initialCriteria: SearchCriteria = {
      filterFields: defaultFilterFields,
      pageSize: 10,
      pageNum: 0,
      direction: 'ASC',
      sortField: 'location.name'
    };
    let newFilterFields = [...initialCriteria.filterFields];
    filterFields.forEach(
      (filterField) =>
      (newFilterFields = newFilterFields.filter(
        (ff) => ff.field != filterField.field
      ))
    );
    return {
      ...initialCriteria,
      filterFields: [...newFilterFields, ...filterFields]
    };
  };

  const [criteria, setCriteria] = useState<SearchCriteria>(
    getCriteriaFromFilterFields([])
  );
  // [CORREGIDO] Fix primera búsqueda sin resultados
  // Impacto: Agrega 'view' a las dependencias del useEffect
  // Beneficio: La primera búsqueda ahora ejecuta getAssets correctamente
  // [CORREGIDO] Fix primera búsqueda sin resultados
  // Impacto: Estabilidad de Búsqueda Móvil
  // Explicación: Anteriormente, este efecto solo escuchaba cambios en 'criteria'.
  // Al realizar la primera búsqueda, el cambio de vista a 'list' ocurría después del cambio de criteria,
  // por lo que la condición view === 'list' fallaba.
  // Al agregar 'view' a las dependencias, aseguramos que la búsqueda se ejecute tan pronto como la vista cambie.
  useEffect(() => {
    if (hasViewPermission(PermissionEntity.ASSETS) && view === 'list') {
      dispatch(
        getAssets({ ...criteria, pageSize: 10, pageNum: 0, direction: 'ASC', sortField: 'location.name' })
      );
    }
  }, [criteria, view]);  // ✅ Agregado 'view' a las dependencias
  const [currentAssets, setCurrentAssets] = useState<AssetRow[]>([]);
  useEffect(() => {
    if (
      route.params?.id &&
      assetsHierarchy.some(
        (asset) =>
          asset.hierarchy.includes(route.params.id) &&
          asset.id !== route.params.id
      )
    ) {
      return;
    }
    dispatch(
      getAssetChildren(route.params?.id ?? 0, route.params?.hierarchy ?? [])
    );
  }, [route]);

  const onRefresh = () => {
    setCriteria(getCriteriaFromFilterFields([]));
  };


  const onQueryChange = (query) => {
    // [MODIFICADO] Búsqueda Multicampo
    // Impacto: Busca en 'name' Y 'location.name'.
    // Beneficio: Permite encontrar activos por su nombre o por su ubicación.
    onSearchQueryChange<AssetDTO>(
      query,
      criteria,
      setCriteria,
      setSearchQuery,
      // @ts-ignore
      ['name', 'model', 'description', 'additionalInfos', 'location.name']
    );
    setView('list');
  };

  // [MODIFICADO] Optimización de Búsqueda: Debounce
  // Impacto: Reducido de 1000ms a 500ms.
  // Beneficio: La búsqueda se siente más rápida y responsiva.
  useDebouncedEffect(
    () => {
      if (startedSearch) onQueryChange(searchQuery);
    },
    [searchQuery],
    500
  );

  useEffect(() => {
    let result = [];
    if (route.params?.id) {
      result = assetsHierarchy.filter((asset, index) => {
        return (
          asset.hierarchy[asset.hierarchy.length - 2] === route.params.id &&
          asset.id !== route.params.id
        );
      });
    } else
      result = assetsHierarchy.filter((asset) => asset.hierarchy.length === 1);
    setCurrentAssets(result);
  }, [assetsHierarchy]);

  // [MODIFICADO] Optimización de Rendimiento: useCallback
  // Impacto: Mantiene estable la referencia de la función entre renderizados.
  // Beneficio: Evita re-crear la función innecesariamente, ayudando a React.memo.
  const handleViewChildren = React.useCallback((asset) => {
    navigation.push('Assets', {
      id: asset.id,
      hierarchy: asset.hierarchy
    });
  }, [navigation]);

  return (
    <View
      style={{ ...styles.container, backgroundColor: theme.colors.background }}
    >
      <Searchbar
        placeholder={t('search')}
        onFocus={() => setStartedSearch(true)}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={{ backgroundColor: theme.colors.background }}
      />
      {view === 'list' ? (
        <FlatList
          style={styles.scrollView}
          data={assets.content}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <AssetCard asset={item} navigation={navigation} />
          )}
          onEndReached={() => {
            if (!loadingGet && !lastPage) {
              dispatch(getMoreAssets(criteria, currentPageNum + 1));
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={loadingGet}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
          ListFooterComponent={
            loadingGet && !assets.content.length ? (
              <ActivityIndicator
                animating={true}
                color={theme.colors.primary}
                style={{ margin: 10 }}
              />
            ) : null
          }
          ListEmptyComponent={
            !loadingGet ? (
              <View
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  borderRadius: 10
                }}
              >
                <Text variant={'titleLarge'}>
                  {t('no_element_match_criteria')}
                </Text>
              </View>
            ) : null
          }
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={loadingGet}
              colors={[theme.colors.primary]}
            />
          }
        >
          {!!currentAssets.length &&
            currentAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                navigation={navigation}
                showChildrenButton={true}
                onViewChildren={() => handleViewChildren(asset)}
              />
            ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  scrollView: {
    width: '100%',
    height: '100%',
    padding: 5
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  }
});
