import os
import uuid

from django.utils.text import slugify


def document_version_upload_path(instance, filename):
    ext = os.path.splitext(filename or "")[1].lower() or ".pdf"
    safe = slugify(os.path.splitext(filename or "document")[0])[:60] or "document"
    unique = uuid.uuid4().hex[:8]
    return f"versions_document/{instance.document_id}/v{instance.version_number}/{safe}_{unique}{ext}"
