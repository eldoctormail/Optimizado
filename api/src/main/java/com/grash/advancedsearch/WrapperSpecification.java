package com.grash.advancedsearch;

import com.grash.model.enums.EnumName;
import com.grash.model.enums.Priority;
import com.grash.model.enums.Status;
import com.grash.utils.Helper;
import org.springframework.data.jpa.domain.Specification;

import javax.persistence.criteria.*;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

public class WrapperSpecification<T> implements Specification<T> {

    private final FilterField filterField;

    public WrapperSpecification(final FilterField filterField) {
        super();
        this.filterField = filterField;
    }

    @Override
    public Predicate toPredicate(Root<T> root, CriteriaQuery<?> query, CriteriaBuilder cb) {

        String strToSearch = filterField.getValue().toString().toLowerCase();
        Predicate result = null;
        switch (Objects.requireNonNull(SearchOperation.getSimpleOperation(filterField.getOperation()))) {
            case CONTAINS:
                result = cb.like(
                    cb.function("unaccent", String.class, cb.lower((Expression<String>) getFieldPath(root, filterField.getField()))),
                    "%" + removeAccents(strToSearch) + "%"
                );
                break;
            case DOES_NOT_CONTAIN:
                result = cb.notLike(
                    cb.function("unaccent", String.class, cb.lower((Expression<String>) getFieldPath(root, filterField.getField()))),
                    "%" + removeAccents(strToSearch) + "%"
                );
                break;
            case BEGINS_WITH:
                result = cb.like(
                    cb.function("unaccent", String.class, cb.lower((Expression<String>) getFieldPath(root, filterField.getField()))),
                    removeAccents(strToSearch) + "%"
                );
                break;
            case DOES_NOT_BEGIN_WITH:
                result = cb.notLike(
                    cb.function("unaccent", String.class, cb.lower((Expression<String>) getFieldPath(root, filterField.getField()))),
                    removeAccents(strToSearch) + "%"
                );
                break;
            case ENDS_WITH:
                result = cb.like(
                    cb.function("unaccent", String.class, cb.lower((Expression<String>) getFieldPath(root, filterField.getField()))),
                    "%" + removeAccents(strToSearch)
                );
                break;
            case DOES_NOT_END_WITH:
                result = cb.notLike(
                    cb.function("unaccent", String.class, cb.lower((Expression<String>) getFieldPath(root, filterField.getField()))),
                    "%" + removeAccents(strToSearch)
                );
                break;
            case EQUAL:
                result = cb.equal(getFieldPath(root, filterField.getField()), filterField.getValue());
                break;
            case NOT_EQUAL:
                result = cb.notEqual(root.get(filterField.getField()), filterField.getValue());
                break;
            case NUL:
                result = cb.isNull(root.get(filterField.getField()));
                break;
            case NOT_NULL:
                result = cb.isNotNull(root.get(filterField.getField()));
                break;
            case GREATER_THAN:
                result = cb.greaterThan((Expression<Comparable>) getFieldPath(root, filterField.getField()), (Comparable) filterField.getValue());
                break;
            case GREATER_THAN_EQUAL:
                if (filterField.getEnumName() != null && filterField.getEnumName().equals(EnumName.JS_DATE)) {
                    result = cb.greaterThanOrEqualTo((Expression<Comparable>) getFieldPath(root, filterField.getField()), (Comparable) Helper.getDateFromJsString(filterField.getValue().toString()));
                } else {
                    result = cb.greaterThanOrEqualTo((Expression<Comparable>) getFieldPath(root, filterField.getField()), (Comparable) filterField.getValue());
                }
                break;
            case LESS_THAN:
                result = cb.lessThan((Expression<Comparable>) getFieldPath(root, filterField.getField()), (Comparable) filterField.getValue());
                break;
            case LESS_THAN_EQUAL:
                if (filterField.getEnumName() != null && filterField.getEnumName().equals(EnumName.JS_DATE)) {
                    result = cb.lessThanOrEqualTo((Expression<Comparable>) getFieldPath(root, filterField.getField()), (Comparable) Helper.getDateFromJsString(filterField.getValue().toString()));
                } else {
                    result = cb.lessThanOrEqualTo((Expression<Comparable>) getFieldPath(root, filterField.getField()), (Comparable) filterField.getValue());
                }
                break;
            case IN:
                CriteriaBuilder.In<Object> inClause = cb.in(getFieldPath(root, filterField.getField()));
                filterField.getValues().forEach(value -> inClause.value(getRealValue(filterField.getEnumName(), value)));
                result = inClause;
                break;
            case IN_MANY_TO_MANY:
                Join<Object, Object> join = root.join(filterField.getField(), filterField.getJoinType());
                CriteriaBuilder.In<Object> inClause1 = cb.in(join.get("id"));
                filterField.getValues().forEach(inClause1::value);
                result = inClause1;
                break;
        }
        return wrapAlternatives(result, root, query, cb);
    }

    private Predicate wrapAlternatives(Predicate result, Root<T> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        if (filterField.getAlternatives() == null || filterField.getAlternatives().size() == 0) {
            return result;
        } else {
            List<SpecificationBuilder<T>> specificationBuilders = filterField.getAlternatives().stream().map(alternative -> {
                SpecificationBuilder<T> builder = new SpecificationBuilder<>();
                builder.with(alternative);
                return builder;
            }).collect(Collectors.toList());
            List<Predicate> predicates = specificationBuilders.stream().map(specificationBuilder -> specificationBuilder.build().toPredicate(root, query, cb)).collect(Collectors.toList());
            predicates.add(result);
            Predicate[] predicatesArray = predicates.toArray(new Predicate[0]);
            return cb.or(predicatesArray);
        }
    }

    private Object getRealValue(EnumName enumName, Object value) {
        if (enumName == null) {
            return value;
        }
        if (value instanceof String) {
            switch (enumName) {
                case PRIORITY:
                    return Priority.getPriorityFromString(value.toString());
                case STATUS:
                    return Status.getStatusFromString(value.toString());
                case JS_DATE:
                    return Helper.getDateFromJsString(value.toString());
                default:
                    return value;
            }
        }
        return value;
    }

    /**
     * Removes accents from a string for normalized searching.
     * This normalizes the search term to match PostgreSQL's unaccent() function behavior.
     */
    /**
     * [MODIFICADO] Normalización de Texto
     * Impacto: Elimina acentos y convierte a minúsculas.
     * Beneficio: Permite búsquedas insensibles a acentos y mayúsculas (ej: "Alcolea" == "alcolea").
     */
    private String removeAccents(String input) {
        if (input == null) return null;
        return java.text.Normalizer.normalize(input, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
            .toLowerCase();
    }

    /**
     * [MODIFICADO] Navegación Segura de Campos
     * Impacto: Usa LEFT JOIN para acceder a propiedades anidadas (ej: location.name).
     * Beneficio: Evita errores (crashes) cuando la relación es nula y permite buscar en sub-entidades.
     */
    private Path<?> getFieldPath(Root<T> root, String field) {
        String[] fieldNames = field.split("\\.");
        if (fieldNames.length > 1) {
            From<?, ?> from = root;
            for (int i = 0; i < fieldNames.length - 1; i++) {
                from = getOrCreateJoin(from, fieldNames[i], JoinType.LEFT);
            }
            return from.get(fieldNames[fieldNames.length - 1]);
        }
        return root.get(field);
    }

    /**
     * [MODIFICADO] Reutilización de Uniones
     * Impacto: Verifica si ya existe una unión antes de crear una nueva.
     * Beneficio: Optimiza la consulta SQL y evita errores de "uniones duplicadas" en JPA.
     */
    private Join<?, ?> getOrCreateJoin(From<?, ?> from, String attributeName, JoinType joinType) {
        for (Join<?, ?> join : from.getJoins()) {
            if (join.getAttribute().getName().equals(attributeName)) {
                return join;
            }
        }
        return from.join(attributeName, joinType);
    }
}
