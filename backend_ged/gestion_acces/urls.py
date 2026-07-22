from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.profile_view import user_profile_view
from .views.user_view import UserViewSet
from .views.group_view import GroupViewSet, modules_list_view, localites_dernier_niveau_view
from .views.entreprise_view import (
    entreprise_view,
    entreprise_update_view,
    entreprise_reset_view,
)
from .views.lien_telechargement_view import (
    LienTelechargementViewSet,
    telechargement_fichier_view,
    telechargement_info_view,
    telechargement_public_redirect_view,
)
from .views.permission_view import PermissionViewSet
from .views.user_signature_view import UserSignatureViewSet
from .views.journal_activite_view import JournalActiviteViewSet
from .views.configuration_email_view import (
    configuration_email_view,
    configuration_email_update_view,
)
from .views.analytics_view import (
    analytics_administration_view,
    analytics_documents_geo_view,
    analytics_documents_view,
    analytics_meta_view,
)
from .views.notification_view import (
    configuration_resume_view,
    envoyer_resume_test_view,
    journal_notifications_view,
    modele_email_preview_view,
    modele_email_reset_view,
    modele_email_update_view,
    notifications_config_view,
    preferences_notification_view,
    regle_notification_update_view,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"permissions", PermissionViewSet, basename="permission")
router.register(r"liens-telechargement", LienTelechargementViewSet, basename="lien-telechargement")
router.register(r"signatures", UserSignatureViewSet, basename="user-signature")
router.register(r"journal-activite", JournalActiviteViewSet, basename="journal-activite")

urlpatterns = [
    path("telechargement/<uuid:token>/", telechargement_public_redirect_view, name="telechargement_public"),
    path("telechargement/<uuid:token>/info/", telechargement_info_view, name="telechargement_info"),
    path("telechargement/<uuid:token>/fichier/", telechargement_fichier_view, name="telechargement_fichier"),
    path("profile/", user_profile_view, name="user_profile"),
    path("entreprise/", entreprise_view, name="entreprise"),
    path("entreprise/update/", entreprise_update_view, name="entreprise_update"),
    path("entreprise/reset/", entreprise_reset_view, name="entreprise_reset"),
    path("configuration-email/", configuration_email_view, name="configuration_email"),
    path("configuration-email/update/", configuration_email_update_view, name="configuration_email_update"),
    path("notifications/config/", notifications_config_view, name="notifications_config"),
    path("notifications/regles/<str:event_type>/", regle_notification_update_view, name="notification_regle_update"),
    path("notifications/modeles/<str:code>/", modele_email_update_view, name="notification_modele_update"),
    path("notifications/modeles/<str:code>/reset/", modele_email_reset_view, name="notification_modele_reset"),
    path("notifications/modeles-preview/", modele_email_preview_view, name="notification_modele_preview"),
    path("notifications/resume/", configuration_resume_view, name="notification_resume"),
    path("notifications/resume/envoyer/", envoyer_resume_test_view, name="notification_resume_envoyer"),
    path("notifications/preferences/", preferences_notification_view, name="notification_preferences"),
    path("notifications/journal/", journal_notifications_view, name="notification_journal"),
    path("analytics/meta/", analytics_meta_view, name="analytics_meta"),
    path("analytics/documents/", analytics_documents_view, name="analytics_documents"),
    path("analytics/documents/geo/", analytics_documents_geo_view, name="analytics_documents_geo"),
    path("analytics/administration/", analytics_administration_view, name="analytics_administration"),
    path("modules/", modules_list_view, name="modules_list"),
    path("localites/dernier-niveau/", localites_dernier_niveau_view, name="localites_dernier_niveau"),
    path("", include(router.urls)),
]
