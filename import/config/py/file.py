import frappe
from frappe.core.doctype.file.file import File

class CustomFile(File):

    def before_insert(self):
        # force file public
        self.is_private = 0
        super().before_insert()

    def validate(self):
        self.is_private = 0
        super().validate()