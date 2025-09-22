frappe.ui.form.on("Request for Quotation", {
    custom_shipment_address: function (frm) {
        erpnext.utils.get_address_display(frm, "custom_shipment_address", "custom_shipment_address_details", false);
    },
    billing_address: function (frm) {
        erpnext.utils.get_address_display(frm, "billing_address", "billing_address_display", false);
    },
    custom_currency: function (frm) {
        frappe.call({
            method: "erpnext.setup.utils.get_exchange_rate",
            args: {
                from_currency: frm.doc.custom_currency,
                to_currency: "INR",
                transaction_date: frappe.datetime.get_today()
            },
            callback: function (r) {
                frm.set_value("custom_currency_rate", r.message)
            }
        })
    },
    custom_pickup_request: function (frm) {
        frappe.call({
            method: "import.import.api.get_api_list",
            args: {
                pr: frm.doc.custom_pickup_request
            },
            callback: function (r) {

                var data = r.message[2]
                data.forEach(function (obj) {
                    var row = frm.add_child("custom_purchase_order")
                    row.purchase_order = obj.po_number
                })
                frm.refresh_field("custom_purchase_order")
            }
        })
    },
    before_save: function (frm) {
        if (!frm.doc.custom_previously_data || frm.doc.custom_previously_data.length === 0) {
            let suppliers_list = [];
            frm.doc.suppliers.forEach(row => {
                if (row.supplier) {
                    suppliers_list.push(row.supplier);
                }
            });
            console.log(suppliers_list)
            frm.doc.items.forEach(row => {
                if (row.item_code) {
                    frappe.call({
                        method: "import.config.py.rfq.get_supplier_previously_data",
                        args: {
                            item_code: row.item_code,
                            suppliers: suppliers_list
                        },
                        callback: function (r) {
                            if (r.message) {
                                add_data_in_child_table(frm, row.doctype, row.name, r.message);
                            }
                        }
                    });
                }
            });
        }
    }
})

frappe.ui.form.on("Request for Quotation Item", {
    item_code: function (frm, cdt, cdn) {
        let suppliers_list = [];
        frm.doc.suppliers.forEach(row => {
            if (row.supplier) {
                suppliers_list.push(row.supplier);
            }
        });
        let item = locals[cdt][cdn];
        frappe.call({
            method: "import.config.py.rfq.get_supplier_previously_data",
            args: {
                item_code: item.item_code,
                suppliers: suppliers_list
            },
            callback: function (r) {
                if (r.message) {
                    add_data_in_child_table(frm, cdt, cdn, r.message);
                }
            }
        });
    },
    form_render: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        // Update the HTML display for the current row
        updateChargesHtml(frm, cdt, cdn);
    }
})

function add_data_in_child_table(frm, cdt, cdn, data) {
    var d = locals[cdt][cdn];

    // Loop through the supplier data returned
    for (let supplier in data) {
        if (data.hasOwnProperty(supplier)) {
            let item_data = data[supplier];
            let supplier_exists = false;

            // Check if a row with the same supplier and item_code already exists
            frm.doc.custom_previously_data.forEach(item => {
                if (item.supplier === supplier && item.item_code === d.item_code) {
                    supplier_exists = true;
                    return false;
                }
            });

            if (supplier_exists) continue;

            // Add new row if not already present
            let row = frm.add_child("custom_previously_data");
            row.supplier = supplier;
            row.rate = item_data.rate;
            row.qty = item_data.qty;
            row.received_qty = item_data.received_qty;
            row.item_code = d.item_code;
        }
    }
    frm.refresh_field("custom_previously_data");
}


function updateChargesHtml(frm, cdt, cdn) {
    var d = locals[cdt][cdn];

    // Correct reference to the child table's HTML field
    let row = frm.fields_dict['items'].grid.grid_rows_by_docname[cdn];
    if (!row) return;

    let wrapper = row.grid_form.fields_dict['custom_previously_data'];
    if (!wrapper) return;

    let html = `
        <style>
            .wide-table { width: 100%; }
            .text-right { text-align: right; }
        </style>

        <div class="container mt-3">
            <table class="table table-bordered table-hover wide-table" id="supplier-table">
                <thead class="thead-light">
                    <tr>
                        <th class="text-right">Supplier</th>
                        <th class="text-right">Rate</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Received Qty</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Dynamic rows will be added here -->
                </tbody>
            </table>
        </div>
    `;

    // Render the initial HTML table
    $(wrapper.wrapper).html(html);

    // Display stored data
    displayStoredData(frm, d.name, d.item_code);

    // Function to display stored data from child table
    function displayStoredData(frm, item_row_name,) {
        frm.doc.custom_previously_data.forEach(function (data_row) {
            if (data_row.item_code === d.item_code) {
                let newRow = `
                    <tr>
                        <td><input type="text" class="form-control supplier-input" name="supplier" value="${data_row.supplier || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right rate-input" name="rate" value="${data_row.rate || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right qty-input" name="qty" value="${data_row.qty || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right received-qty-input" name="received_qty" value="${data_row.received_qty || ''}" readonly></td>
                    </tr>
                `;

                $(wrapper.wrapper).find('#supplier-table tbody').append(newRow);
            }
        });

        frm.refresh_field('items');
    }
}

