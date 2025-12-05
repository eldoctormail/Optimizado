package com.grash.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.grash.model.abstracts.CompanyAudit;
import com.grash.model.enums.AssetStatus;
import com.grash.utils.Helper;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import javax.persistence.*;
import javax.validation.constraints.NotNull;
import java.util.*;
import java.util.concurrent.TimeUnit;

import static java.util.Comparator.comparingLong;
import static java.util.stream.Collectors.collectingAndThen;
import static java.util.stream.Collectors.toCollection;

@Entity
@Data
@NoArgsConstructor
public class Asset extends CompanyAudit {

    private String customId;

    private boolean archived;

    // [MODIFICADO] Cambiado a FetchType.LAZY.
    // Impacto: Evita cargar la imagen del activo automáticamente, ahorrando ancho de banda.
    @OneToOne(fetch = FetchType.LAZY)
    private File image;

    // [MODIFICADO] Cambiado a FetchType.LAZY.
    // Impacto: Evita cargar la ubicación completa en cada consulta de activo.
    @ManyToOne(fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    private Location location;

    // [MODIFICADO] Cambiado a FetchType.LAZY.
    // Impacto: Previene la carga recursiva de activos padres.
    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @BatchSize(size = 50)
    private Asset parentAsset;

    private String area;

    private String description;

    private String barCode;

    // [MODIFICADO] Cambiado a FetchType.LAZY.
    // Impacto: Evita cargar la categoría en listados simples.
    @ManyToOne(fetch = FetchType.LAZY)
    private AssetCategory category;

    @NotNull
    private String name;

    // [MODIFICADO] Cambiado a FetchType.LAZY.
    // Impacto: Optimiza la carga al no traer datos del usuario principal innecesariamente.
    @ManyToOne(fetch = FetchType.LAZY)
    private OwnUser primaryUser;

    private Double acquisitionCost;

    private String nfcId;

    @ManyToMany
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @JoinTable(name = "T_Asset_User_Associations",
            joinColumns = @JoinColumn(name = "id_asset"),
            inverseJoinColumns = @JoinColumn(name = "id_user"),
            indexes = {
                    @Index(name = "idx_asset_user_asset_id", columnList = "id_asset"),
                    @Index(name = "idx_asset_user_user_id", columnList = "id_user")
            })
    private List<OwnUser> assignedTo = new ArrayList<>();

    @ManyToMany
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @JoinTable(name = "T_Asset_Team_Associations",
            joinColumns = @JoinColumn(name = "id_asset"),
            inverseJoinColumns = @JoinColumn(name = "id_team"),
            indexes = {
                    @Index(name = "idx_asset_team_asset_id", columnList = "id_asset"),
                    @Index(name = "idx_asset_team_team_id", columnList = "id_team")
            })
    private List<Team> teams = new ArrayList<>();

    @ManyToMany
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @JoinTable(name = "T_Asset_Vendor_Associations",
            joinColumns = @JoinColumn(name = "id_asset"),
            inverseJoinColumns = @JoinColumn(name = "id_vendor"),
            indexes = {
                    @Index(name = "idx_asset_vendor_asset_id", columnList = "id_asset"),
                    @Index(name = "idx_asset_vendor_vendor_id", columnList = "id_vendor")
            })
    private List<Vendor> vendors = new ArrayList<>();

    @ManyToMany
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @JoinTable(name = "T_Asset_Customer_Associations",
            joinColumns = @JoinColumn(name = "id_asset"),
            inverseJoinColumns = @JoinColumn(name = "id_customer"),
            indexes = {
                    @Index(name = "idx_asset_customer_asset_id", columnList = "id_asset"),
                    @Index(name = "idx_asset_customer_customer_id", columnList = "id_customer")
            })
    private List<Customer> customers = new ArrayList<>();

    @ManyToMany
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @JoinTable(name = "T_Asset_Part_Associations",
            joinColumns = @JoinColumn(name = "id_asset"),
            inverseJoinColumns = @JoinColumn(name = "id_part"),
            indexes = {
                    @Index(name = "idx_asset_part_asset_id", columnList = "id_asset"),
                    @Index(name = "idx_asset_part_part_id", columnList = "id_part")
            })
    private List<Part> parts = new ArrayList<>();

    @OneToOne
    private Deprecation deprecation;

    private Date warrantyExpirationDate;

    private Date inServiceDate;

    private String additionalInfos;

    private String serialNumber;

    private String model;

    private AssetStatus status = AssetStatus.OPERATIONAL;

    @ManyToMany
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @JoinTable(name = "T_Asset_File_Associations",
            joinColumns = @JoinColumn(name = "id_asset"),
            inverseJoinColumns = @JoinColumn(name = "id_file"),
            indexes = {
                    @Index(name = "idx_asset_file_asset_id", columnList = "id_asset"),
                    @Index(name = "idx_asset_file_file_id", columnList = "id_file")
            })
    private List<File> files = new ArrayList<>();

    private String power;

    private String manufacturer;

    public Collection<OwnUser> getUsers() {
        Collection<OwnUser> users = new ArrayList<>();
        if (this.getPrimaryUser() != null) {
            users.add(this.getPrimaryUser());
        }
        if (this.getTeams() != null) {
            Collection<OwnUser> teamsUsers = new ArrayList<>();
            this.getTeams().forEach(team -> teamsUsers.addAll(team.getUsers()));
            users.addAll(teamsUsers);
        }
        if (this.getAssignedTo() != null) {
            users.addAll(this.getAssignedTo());
        }
        return users.stream().collect(collectingAndThen(toCollection(() -> new TreeSet<>(comparingLong(OwnUser::getId))),
                ArrayList::new));
    }

    public List<OwnUser> getNewUsersToNotify(Collection<OwnUser> newUsers) {
        Collection<OwnUser> oldUsers = getUsers();
        return newUsers.stream().filter(newUser -> oldUsers.stream().noneMatch(user -> user.getId().equals(newUser.getId()))).
                collect(collectingAndThen(toCollection(() -> new TreeSet<>(comparingLong(OwnUser::getId))),
                        ArrayList::new));
    }

    @JsonIgnore
    public long getAge() {
        return Helper.getDateDiff(getRealCreatedAt(), new Date(), TimeUnit.SECONDS);
    }

    @JsonIgnore
    public Date getRealCreatedAt() {
        return this.inServiceDate == null ? this.getCreatedAt() : this.inServiceDate;
    }
}



