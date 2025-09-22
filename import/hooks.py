app_name = "import"
app_title = "Import"
app_publisher = "Pragati Dike"
app_description = "Import Module"
app_email = "pragati@mail.hybrowlabs.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "import",
# 		"logo": "/assets/import/logo.png",
# 		"title": "Import",
# 		"route": "/import",
# 		"has_permission": "import.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/import/css/import.css"
# app_include_js = "/assets/import/js/import.js"

# include js, css files in header of web template
# web_include_css = "/assets/import/css/import.css"
# web_include_js = "/assets/import/js/import.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "import/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "import/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "import.utils.jinja_methods",
# 	"filters": "import.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "import.install.before_install"
# after_install = "import.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "import.uninstall.before_uninstall"
# after_uninstall = "import.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "import.utils.before_app_install"
# after_app_install = "import.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "import.utils.before_app_uninstall"
# after_app_uninstall = "import.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "import.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"import.tasks.all"
# 	],
# 	"daily": [
# 		"import.tasks.daily"
# 	],
# 	"hourly": [
# 		"import.tasks.hourly"
# 	],
# 	"weekly": [
# 		"import.tasks.weekly"
# 	],
# 	"monthly": [
# 		"import.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "import.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "import.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "import.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["import.utils.before_request"]
# after_request = ["import.utils.after_request"]

# Job Events
# ----------
# before_job = ["import.utils.before_job"]
# after_job = ["import.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"import.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }



doctype_js = {
        "Material Request": "public/js/material_request.js",
        "Request for Quotation": "public/js/rfq.js",
        "Purchase Order": "public/js/purchase_order.js",
        "Supplier Quotation": "public/js/supplier_quotation.js",
        "Purchase Invoice": "public/js/purchase_invoice.js",
        "Payment Entry": "public/js/payment_entry.js",
        # "Bill of Entry": "public/js/e_waybill_action.js",

}



override_doctype_dashboards = {
    "Purchase Order": "import.config.py.po_dashboard.get_dashboard_data",
    "Pickup Request": "import.import.doctype.pickup_request.pickup_request.get_dashboard_data",
}


override_whitelisted_methods = {
    "erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice":
        "import.config.py.purchase_order.make_purchase_invoice",
}

doc_events = {
    "Payment Entry": {
        "before_save": "import.config.py.payment_entry.set_custom_fields",
        "validate": "import.config.py.payment_entry.doc_attachment",
        "before_submit": "import.config.py.payment_entry.doc_attachment2"
    },
    "BOE": {
        "on_submit": "import.config.py.bill_of_entry.update_payment_request"
    },
    "Request for Quotation": {
        "on_submit": "import.config.py.rfq.on_rfq_submit"
    }
}
