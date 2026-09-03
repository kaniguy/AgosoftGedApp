from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from ..serializers.profile_serializer import UserSerializer
from gestion_acces.services.access_service import get_user_access_payload

@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def user_profile_view(request):
    user = request.user
    
    if request.method == "GET":
        serializer = UserSerializer(user, context={"request": request})
        access = get_user_access_payload(user)
        return Response({**serializer.data, **access})
        
    elif request.method in ["PUT", "PATCH"]:
        # Changement de mot de passe si fournis
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        
        if old_password or new_password:
            if not old_password or not new_password:
                return Response(
                    {"detail": "Veuillez fournir l'ancien et le nouveau mot de passe."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not user.check_password(old_password):
                return Response(
                    {"detail": "L'ancien mot de passe est incorrect."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                validate_password(new_password, user=user)
            except ValidationError as exc:
                return Response(
                    {"detail": " ".join(exc.messages)},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.set_password(new_password)
            user.save()

        serializer = UserSerializer(user, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
